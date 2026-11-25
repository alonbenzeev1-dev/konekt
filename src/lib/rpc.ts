/** PostgREST says this when a function (or one of its parameters) does not exist yet, i.e. a SQL migration has not been applied. */
export const isMissingFunction = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === 'PGRST202' || /could not find the function/i.test(e.message ?? ''));
