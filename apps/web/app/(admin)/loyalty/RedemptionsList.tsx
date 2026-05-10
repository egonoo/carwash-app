type Row = {
  id: string;
  createdAt: Date;
  visitCountAtRedemption: number;
  discountAppliedCents: number;
  grantedManually: boolean;
  vehicle: { internalCode: string; make: string | null; model: string | null } | null;
  customer: { firstName: string; lastName: string | null } | null;
};

export function RedemptionsList({ rows }: { rows: Row[] }) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold">Recent redemptions</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">No redemptions yet.</p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="py-2">Date</th>
              <th>Vehicle</th>
              <th>Customer</th>
              <th>Visit #</th>
              <th>Discount</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-2">{r.createdAt.toLocaleDateString()}</td>
                <td>
                  {r.vehicle?.internalCode} {r.vehicle?.make} {r.vehicle?.model}
                </td>
                <td>
                  {r.customer?.firstName} {r.customer?.lastName}
                </td>
                <td>{r.visitCountAtRedemption}</td>
                <td>${(r.discountAppliedCents / 100).toFixed(2)}</td>
                <td>{r.grantedManually ? 'Manual' : 'Auto'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
