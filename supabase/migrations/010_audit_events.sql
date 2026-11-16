-- ====================================================================
-- EstateVista audit events for CRM actions
-- Extends the original foundation event list with the WP4 CRM events.
-- ====================================================================

alter table public.audit_logs
  drop constraint if exists audit_logs_event_check;

alter table public.audit_logs
  add constraint audit_logs_event_check check (
    event in (
      'created',
      'updated',
      'deleted',
      'login',
      'logout',
      'password_changed',
      'status_changed',
      'followup_added',
      'followup_completed',
      'converted'
    )
  );
