CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER session_confirmations_no_update BEFORE UPDATE ON session_confirmations
BEGIN SELECT RAISE(ABORT, 'session_confirmations is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER session_confirmations_no_delete BEFORE DELETE ON session_confirmations
BEGIN SELECT RAISE(ABORT, 'session_confirmations is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER sessions_no_delete BEFORE DELETE ON sessions
BEGIN SELECT RAISE(ABORT, 'sessions cannot be deleted'); END;
--> statement-breakpoint
CREATE TRIGGER sessions_insert_initial_state BEFORE INSERT ON sessions
WHEN NEW.status <> 'PENDING' OR NEW.validated_minutes <> 0 OR NEW.tutor_declared_at IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'a new session must be PENDING with no validated minutes'); END;
--> statement-breakpoint
CREATE TRIGGER sessions_core_fields_immutable BEFORE UPDATE ON sessions
WHEN NEW.id <> OLD.id OR NEW.code <> OLD.code OR NEW.tutor_id <> OLD.tutor_id
  OR NEW.tutee_id <> OLD.tutee_id OR NEW.subject_id <> OLD.subject_id
  OR NEW.created_at <> OLD.created_at
BEGIN SELECT RAISE(ABORT, 'session identity fields are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER sessions_declaration_write_once BEFORE UPDATE ON sessions
WHEN OLD.tutor_declared_at IS NOT NULL
  AND (NEW.tutor_declared_at IS NOT OLD.tutor_declared_at
    OR NEW.tutor_duration_min IS NOT OLD.tutor_duration_min)
BEGIN SELECT RAISE(ABORT, 'tutor declaration cannot be modified'); END;
--> statement-breakpoint
CREATE TRIGGER sessions_validated_minutes_consistent BEFORE UPDATE ON sessions
WHEN (NEW.status <> 'VALIDATED' AND NEW.validated_minutes <> 0)
  OR (NEW.status = 'VALIDATED' AND (NEW.tutor_duration_min IS NULL
    OR NEW.validated_minutes <= 0 OR NEW.validated_minutes > NEW.tutor_duration_min))
BEGIN SELECT RAISE(ABORT, 'validated minutes inconsistent with status or declaration'); END;
