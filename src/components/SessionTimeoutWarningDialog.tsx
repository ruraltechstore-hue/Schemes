import { Clock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface SessionTimeoutWarningDialogProps {
  open: boolean;
  onStayLoggedIn: () => void;
}

/**
 * Dialog alerting the agent 1 minute prior to automatic logout due to inactivity.
 * Clicking "Stay Logged In" resets the inactivity timer.
 */
export function SessionTimeoutWarningDialog({
  open,
  onStayLoggedIn,
}: SessionTimeoutWarningDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent data-testid="session-timeout-warning-dialog" className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
            <Clock className="h-5 w-5 text-amber-600 animate-pulse" />
            Session Inactivity Warning
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-foreground/90 font-medium pt-1">
            Your session will expire in 1 minute due to inactivity. Continue working to remain
            logged in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="pt-2">
          <AlertDialogAction
            onClick={onStayLoggedIn}
            data-testid="stay-logged-in-button"
            className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Stay Logged In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
