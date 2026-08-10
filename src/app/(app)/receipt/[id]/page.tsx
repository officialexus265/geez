"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Receipt } from "@/components/receipt";

export default function ReceiptPage() {
  const params = useParams();
  const id = params.id as string;
  const [tx, setTx] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", id)
        .single();
      setTx(data);
      setLoading(false);
    }
    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Receipt not found
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      <div className="flex justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
        >
          Download / Print PDF
        </button>
      </div>
      <Receipt
        tx_ref={tx.tx_ref}
        amount={Number(tx.amount)}
        depositor_name={tx.depositor_name}
        note={tx.note}
        created_at={tx.created_at}
        payment_method={tx.payment_method}
      />
    </div>
  );
}
