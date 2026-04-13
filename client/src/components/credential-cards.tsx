export interface Credential {
  username: string;
  password: string;
}

export function CredentialCards({ credentials }: { credentials: Credential[] }) {
  return (
    <div className="credential-cards-grid p-4 print:p-0">
      {credentials.map((c, i) => (
        <div
          key={i}
          className="credential-card border rounded-lg p-4 bg-background print:break-inside-avoid"
        >
          <div className="text-xs text-muted-foreground mb-1">Strikescout</div>
          <div className="font-bold text-lg">{c.username}</div>
          <div className="mt-2 text-sm">
            <span className="text-muted-foreground">Password: </span>
            <span className="font-mono">{c.password}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
