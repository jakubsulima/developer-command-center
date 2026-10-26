-- Run after deploying send-return-reminders and creating the two Vault secrets.
-- Never paste service_role or a VAPID private key into this script.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name='command_reminder_url')
    or not exists (select 1 from vault.decrypted_secrets where name='command_reminder_token') then
    raise exception 'Create command_reminder_url and command_reminder_token in Vault first';
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname='command-return-reminders';
end;
$$;

select cron.schedule('command-return-reminders', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='command_reminder_url' limit 1),
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='command_reminder_token' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$job$);
