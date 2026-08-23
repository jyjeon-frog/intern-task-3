"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          로그인 중...
        </>
      ) : (
        "로그인"
      )}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircleIcon className="size-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="loginId">아이디</Label>
        <Input
          id="loginId"
          name="loginId"
          autoComplete="username"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={!!state.fieldErrors?.loginId}
        />
        {state.fieldErrors?.loginId ? (
          <p className="text-destructive text-sm">{state.fieldErrors.loginId}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!state.fieldErrors?.password}
        />
        {state.fieldErrors?.password ? (
          <p className="text-destructive text-sm">
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}
