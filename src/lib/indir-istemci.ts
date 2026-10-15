/** Sunucu eyleminden base64 dönen bir dosyayı tarayıcıda indirir. */
export function base64Indir(base64: string, dosyaAdi: string, tur = "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([arr], { type: tur }));
  const a = document.createElement("a");
  a.href = url;
  a.download = dosyaAdi;
  a.click();
  URL.revokeObjectURL(url);
}
