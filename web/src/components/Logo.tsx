import { WalletIcon } from "./icons";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-fg">
        <WalletIcon width={20} height={20} />
      </span>
      {!compact && (
        <span className="text-lg font-extrabold tracking-tight text-fg">
          Finanzas
        </span>
      )}
    </div>
  );
}
