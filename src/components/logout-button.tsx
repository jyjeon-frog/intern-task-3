"use client";

import { useFormStatus } from "react-dom";
import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/(app)/actions";

function Inner() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="sm"
      disabled={pending}
      className="shrink-0"
    >
      <LogOutIcon className="size-4" />
      <span>로그아웃</span>
    </Button>
  );
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Inner />
    </form>
  );
}
