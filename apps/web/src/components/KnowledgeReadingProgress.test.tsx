import { render,screen,fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect,it,vi } from "vitest";
import { KnowledgeReadingProgress } from "./KnowledgeReadingProgress";
const updateKnowledge=vi.fn().mockResolvedValue(undefined),notifyUndo=vi.fn();
vi.mock("../app/useStore",()=>({useStore:()=>({updateKnowledge,state:{workspaceTimezone:"Europe/Warsaw"}})}));
vi.mock("./action-feedback-context",()=>({useActionFeedback:()=>({notifyUndo})}));
it("submits the date and book position together with an undo guarded by version",async()=>{
  const user=userEvent.setup();render(<KnowledgeReadingProgress item={{id:"book",version:1,type:"resource",title:"Book",detail:"",resourceFormat:"book"}}/>);
  await user.click(screen.getByText("Pozycja czytania"));fireEvent.change(screen.getByLabelText("Wróć do materiału"),{target:{value:"2026-10-04"}});await user.type(screen.getByLabelText("Bieżąca strona"),"25");await user.type(screen.getByLabelText("Liczba stron"),"100");await user.click(screen.getByRole("button",{name:/^Zapisz$/}));
  expect(updateKnowledge).toHaveBeenCalledWith("book",{revisitOn:"2026-10-04",currentPage:25,totalPages:100,readingLocation:null},1);
  await notifyUndo.mock.calls[0][0].undo();expect(updateKnowledge).toHaveBeenLastCalledWith("book",{revisitOn:null,currentPage:null,totalPages:null,readingLocation:null},2);
});
