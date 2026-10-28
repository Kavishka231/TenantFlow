import { formatMinorUnits } from "@/lib/invoices/money";

type Reports = {
  monthly: { currency: string; points: { amountMinor: number; month: string }[] }[];
  categories: { amountMinor: number; categoryId: string; categoryName: string; color: string; currency: string }[];
};

export function MonthlyExpenseChart({ series }: { series: Reports["monthly"] }) {
  if (!series.length) return <Empty message="No expense data in this period." />;
  return <div className="space-y-6">{series.map(item => { const maximum = Math.max(1, ...item.points.map(point => point.amountMinor)); return <div key={item.currency}><p className="mb-3 font-medium">{item.currency}</p><div className="flex h-48 items-end gap-2 border-b border-l px-3 pt-3">{item.points.map(point => <div key={point.month} className="flex h-full min-w-10 flex-1 flex-col justify-end"><div className="flex flex-1 items-end justify-center" title={`${point.month}: ${formatMinorUnits(point.amountMinor,item.currency)}`}><span className="w-5 rounded-t bg-rose-500" style={{height:`${Math.max(point.amountMinor?3:0,point.amountMinor/maximum*100)}%`}}/></div><span className="py-2 text-center text-[10px] text-muted-foreground">{point.month.slice(5)}</span></div>)}</div></div>; })}</div>;
}

export function ExpenseCategoryChart({ rows }: { rows: Reports["categories"] }) {
  if (!rows.length) return <Empty message="No category spending in this period." />;
  const grouped = [...new Set(rows.map(row => row.currency))];
  return <div className="space-y-5">{grouped.map(currency => { const currencyRows=rows.filter(row=>row.currency===currency); const total=currencyRows.reduce((sum,row)=>sum+row.amountMinor,0); return <div key={currency}><p className="mb-3 font-medium">{currency}</p><div className="space-y-3">{currencyRows.map(row=><div key={row.categoryId}><div className="mb-1 flex justify-between gap-3 text-sm"><span>{row.categoryName}</span><span className="font-medium">{formatMinorUnits(row.amountMinor,currency)}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full" style={{backgroundColor:row.color,width:`${row.amountMinor/Math.max(total,1)*100}%`}}/></div></div>)}</div></div>; })}</div>;
}
function Empty({message}:{message:string}){return <div className="grid h-48 place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">{message}</div>}
