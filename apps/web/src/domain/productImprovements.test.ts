import { describe,expect,it } from "vitest";
import { emptyState } from "../data/empty";
import { selectWeeklyMetrics } from "./weeklyMetrics";
import { deriveHomeSummary } from "./homeSummary";
import { executeDomainCommand } from "./commands";
import { knowledgeUrlKey } from "./http-url";
import { savedActionFilters,savedActionParams,type SavedActionView } from "./savedActionViews";
import { applyReadingChanges,readingPositionLabel } from "./readingProgress";
import { createKnowledgeFilter } from "./knowledgeFilters";
import type { GoalAction,KnowledgeItem } from "./types";
const action = (id:string,changes:Partial<GoalAction>={}): GoalAction => ({id,version:1,title:id,detail:"",status:"ready",position:0,isNext:false,pinnedToToday:false,checklist:[],...changes});
const now = new Date("2026-10-04T10:00:00Z");
describe("product improvements",()=>{
  it("marks missing or previous-week aggregates unavailable, including the workspace's Monday rollover",()=>{
    const state=structuredClone(emptyState); state.workspaceTimezone="Europe/Warsaw";
    expect(selectWeeklyMetrics(state,now,"supabase").available).toBe(false);
    state.weeklySummary={periodStart:"2026-09-28",periodEnd:"2026-10-05",completedActions:5,knowledgeAdded:9,progressUpdates:3,focusMinutes:0};
    expect(selectWeeklyMetrics(state,new Date("2026-10-04T21:59:00Z"),"supabase").available).toBe(true);
    expect(selectWeeklyMetrics(state,new Date("2026-10-04T22:01:00Z"),"supabase").available).toBe(false);
    delete state.weeklySummary.periodStart;
    expect(selectWeeklyMetrics(state,now,"supabase").available).toBe(false);
  });
  it("does not recommend future blockers or scheduled next steps as today's work",()=>{
    const state=structuredClone(emptyState);state.actions=[action("future",{status:"blocked",reviewOn:"2026-10-06",scheduledFor:"2026-09-20",pinnedToToday:true})];
    expect(deriveHomeSummary(state,now)).toMatchObject({attentionCount:0,recommendation:{kind:"calm"}});
    state.goals=[{id:"goal",title:"Cel",outcome:"Rezultat",kind:"custom",status:"active",visibility:"active",priority:"normal"}];
    state.actions=[action("future",{goalId:"goal",isNext:true,status:"blocked",reviewOn:"2026-10-06"})];
    expect(deriveHomeSummary(state,now).recommendation.kind).toBe("calm");
  });
  it("ranks executable work before undated blockers, with pinned work before weekly priority",()=>{
    const state=structuredClone(emptyState);state.actions=[action("undated",{status:"blocked"}),action("priority",{goalId:"goal",scheduledFor:"2026-10-04"}),action("pinned",{pinnedToToday:true})];
    expect(deriveHomeSummary(state,now,"demo",["goal"]).recommendation.title).toContain("pinned");
    state.actions=state.actions.filter((item)=>item.id!=="pinned");
    expect(deriveHomeSummary(state,now,"demo",["goal"]).recommendation.title).toContain("priority");
    state.actions=[...state.actions,action("due",{status:"blocked",reviewOn:"2026-10-04"})];
    expect(deriveHomeSummary(state,now).recommendation.title).toContain("due");
  });
  it("compares URLs conservatively without removing meaningful query or fragment content",()=>{
    expect(knowledgeUrlKey(" HTTPS://EXAMPLE.COM:443 ")).toBe("https://example.com/");
    expect(knowledgeUrlKey("https://example.com?x=1#A")).toBe("https://example.com/?x=1#A");
    expect(knowledgeUrlKey("https://example.com/a?b=1#x")).not.toBe(knowledgeUrlKey("https://example.com/a?b=2#x"));
    expect(knowledgeUrlKey("https://example.com/A")).not.toBe(knowledgeUrlKey("https://example.com/a"));
    expect(knowledgeUrlKey("javascript:alert(1)")).toBeUndefined();
  });
  it("triages an existing material once and retains the original capture",()=>{
    const state=structuredClone(emptyState);state.inbox=[{id:"capture",kind:"link",content:"Original URL",status:"unprocessed",createdAt:now.toISOString()}];state.knowledge=[{id:"material",type:"resource",title:"Existing",detail:""}];state.areas=[{id:"project",name:"Project",visibility:"active",createdAt:"",updatedAt:""}];
    const command={type:"triage_existing_knowledge",inboxId:"capture",knowledgeId:"material",projectId:"project",linkId:"relation",changedAt:now.toISOString()} as const;
    const next=executeDomainCommand(state,command);expect(executeDomainCommand(next,command)).toEqual(next);expect(next.inbox[0]).toMatchObject({content:"Original URL",status:"resolved",resolvedToIds:["material"]});expect(next.knowledgeLinks).toHaveLength(1);expect(next.knowledge).toHaveLength(1);
    const existing=executeDomainCommand({...state,knowledgeLinks:next.knowledgeLinks},command);expect(existing.knowledgeLinks).toHaveLength(1);
  });
  it("round-trips only persistent filter meanings and enforces the saved view limit and conflicts",()=>{
    const filters=savedActionFilters(new URLSearchParams("view=today&project=p&highlight=one&cursor=old&today=2026-09-01"));expect(savedActionParams(filters).toString()).toBe("view=today&project=p");
    let state=structuredClone(emptyState);
    const view=(id:string):SavedActionView=>({id,name:id,filters,filterVersion:1,position:0,version:1,createdAt:"",updatedAt:""});
    for(let i=0;i<5;i++)state=executeDomainCommand(state,{type:"save_action_view",view:view(String(i)),expectedVersion:0});
    expect(()=>executeDomainCommand(state,{type:"save_action_view",view:view("six"),expectedVersion:0})).toThrow(/5 widoków/);
    state=executeDomainCommand(state,{type:"save_action_view",view:{...view("0"),name:"New"},expectedVersion:1});
    expect(()=>executeDomainCommand(state,{type:"delete_action_view",id:"0",expectedVersion:1})).toThrow(/innym urządzeniu/);
    state=executeDomainCommand(state,{type:"delete_action_view",id:"0",expectedVersion:2});
    state=executeDomainCommand(state,{type:"save_action_view",view:view("0"),expectedVersion:0});expect(state.savedActionViews).toHaveLength(5);
  });
  it("distinguishes unknown and page zero without completing a book or a Goal",()=>{
    const book:KnowledgeItem={id:"book",type:"resource",title:"Book",detail:"",resourceFormat:"book",readingStatus:"reading"};
    expect(readingPositionLabel(book)).toBe("");expect(readingPositionLabel(applyReadingChanges(book,{currentPage:0}))).toBe("str. 0");
    const next=applyReadingChanges(book,{currentPage:20,totalPages:100,readingLocation:"Chapter 2",revisitOn:"2026-10-04"});expect(readingPositionLabel(next)).toContain("20%");expect(next.readingStatus).toBe("reading");
    expect(()=>applyReadingChanges(book,{currentPage:101,totalPages:100})).toThrow();expect(()=>applyReadingChanges(book,{currentPage:1.5})).toThrow();expect(()=>applyReadingChanges(book,{revisitOn:"2026-02-30"})).toThrow();
    const state={...structuredClone(emptyState),knowledge:[next,{...next,id:"archive",archivedAt:now.toISOString()},{...next,id:"future",revisitOn:"2026-10-05"}]};expect(state.knowledge.filter(createKnowledgeFilter(state,{revisitOnOrBefore:"2026-10-04"})).map((item)=>item.id)).toEqual(["book"]);
    expect(applyReadingChanges(next,{currentPage:null,revisitOn:null})).toMatchObject({currentPage:undefined,revisitOn:undefined});
  });
});
