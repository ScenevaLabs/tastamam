"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/wordmark";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Kayıt formu yok: yalnızca `npm run admin` ile eklenen hesaplar giriş yapar.
        shouldCreateUser: false,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("sent");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-[linear-gradient(to_bottom,transparent_39px,color-mix(in_oklch,var(--border),transparent_45%)_39px,color-mix(in_oklch,var(--border),transparent_45%)_40px)] bg-[length:100%_40px] p-4">
      <div className="flex w-full max-w-[420px] flex-col gap-7">
        <div className="flex flex-col items-start gap-2.5">
          <Wordmark size="lg" />
          <p className="text-muted-foreground">İşverenin kayıt defteri. Eksiksiz, zamanında.</p>
        </div>
        <div className="flex flex-col gap-4 border border-border bg-card p-7">
          <h1 className="text-[22px] font-bold">Giriş</h1>
          {status === "sent" ? (
            <p className="text-[15px]">
              <span className="font-bold text-[var(--ok)]">Bağlantı gönderildi.</span> {email} adresine
              gelen maildeki bağlantıya tıkla.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">E-posta adresin</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ad@sirketin.com"
                  className="h-11"
                />
              </div>
              {status === "error" && <p className="text-sm text-destructive">{errorMessage}</p>}
              <Button type="submit" size="lg" className="h-11 font-bold" disabled={status === "sending"}>
                {status === "sending" ? "Gönderiliyor..." : "Giriş bağlantısı gönder"}
              </Button>
              <p className="text-[13px] text-muted-foreground">
                Şifre yok. Gelen kutuna tek kullanımlık bir bağlantı göndereceğiz.
              </p>
            </form>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Açık kaynak · AGPL-3.0 · Verilerin kendi sunucunda durur.</p>
      </div>
    </div>
  );
}
