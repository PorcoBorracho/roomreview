"use client";

import { startTransition, useActionState } from "react";

/**
 * Como useActionState, pero sin el reseteo automático del formulario de React 19:
 * si el servidor devuelve un error, lo escrito (usuario, mensaje, email…) se conserva.
 * Uso: <form onSubmit={onSubmit}> en lugar de <form action={action}>.
 */
export function useFormAction<S extends object>(fn: (prev: S, fd: FormData) => Promise<S>, initial: S) {
  const [state, dispatch, pending] = useActionState<S, FormData>(fn, initial as Awaited<S>);
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  }
  return [state, onSubmit, pending] as const;
}
