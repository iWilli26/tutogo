CREATE FUNCTION tutogo_reject() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '%', TG_ARGV[0];
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION tutogo_reject('audit_logs is append-only');
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION tutogo_reject('audit_logs is append-only');
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION tutogo_reject('audit_logs is append-only');
--> statement-breakpoint
CREATE TRIGGER session_confirmations_no_update BEFORE UPDATE ON session_confirmations
FOR EACH ROW EXECUTE FUNCTION tutogo_reject('session_confirmations is immutable');
--> statement-breakpoint
CREATE TRIGGER session_confirmations_no_delete BEFORE DELETE ON session_confirmations
FOR EACH ROW EXECUTE FUNCTION tutogo_reject('session_confirmations is immutable');
--> statement-breakpoint
CREATE TRIGGER session_confirmations_no_truncate BEFORE TRUNCATE ON session_confirmations
FOR EACH STATEMENT EXECUTE FUNCTION tutogo_reject('session_confirmations is immutable');
--> statement-breakpoint
CREATE TRIGGER sessions_no_delete BEFORE DELETE ON sessions
FOR EACH ROW EXECUTE FUNCTION tutogo_reject('sessions cannot be deleted');
--> statement-breakpoint
CREATE TRIGGER sessions_no_truncate BEFORE TRUNCATE ON sessions
FOR EACH STATEMENT EXECUTE FUNCTION tutogo_reject('sessions cannot be deleted');
--> statement-breakpoint
CREATE TRIGGER sessions_insert_initial_state BEFORE INSERT ON sessions
FOR EACH ROW
WHEN (NEW.status <> 'PENDING' OR NEW.validated_minutes <> 0 OR NEW.tutor_declared_at IS NOT NULL)
EXECUTE FUNCTION tutogo_reject('a new session must be PENDING with no validated minutes');
--> statement-breakpoint
CREATE TRIGGER sessions_core_fields_immutable BEFORE UPDATE ON sessions
FOR EACH ROW
WHEN (NEW.id <> OLD.id OR NEW.code <> OLD.code OR NEW.tutor_id <> OLD.tutor_id
  OR NEW.tutee_id <> OLD.tutee_id OR NEW.subject_id <> OLD.subject_id
  OR NEW.created_at <> OLD.created_at)
EXECUTE FUNCTION tutogo_reject('session identity fields are immutable');
--> statement-breakpoint
CREATE TRIGGER sessions_declaration_write_once BEFORE UPDATE ON sessions
FOR EACH ROW
WHEN (OLD.tutor_declared_at IS NOT NULL
  AND (NEW.tutor_declared_at IS DISTINCT FROM OLD.tutor_declared_at
    OR NEW.tutor_duration_min IS DISTINCT FROM OLD.tutor_duration_min))
EXECUTE FUNCTION tutogo_reject('tutor declaration cannot be modified');
--> statement-breakpoint
CREATE TRIGGER sessions_validated_minutes_consistent BEFORE UPDATE ON sessions
FOR EACH ROW
WHEN ((NEW.status <> 'VALIDATED' AND NEW.validated_minutes <> 0)
  OR (NEW.status = 'VALIDATED' AND (NEW.tutor_duration_min IS NULL
    OR NEW.validated_minutes <= 0 OR NEW.validated_minutes > NEW.tutor_duration_min)))
EXECUTE FUNCTION tutogo_reject('validated minutes inconsistent with status or declaration');
