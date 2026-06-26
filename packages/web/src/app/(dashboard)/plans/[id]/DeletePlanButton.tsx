"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

export default function DeletePlanButton({ planId }: { planId: number }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    const isConfirmed = confirm("Bu planı ve içindeki tüm gönderileri kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.");
    if (!isConfirmed) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/plans/${planId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/plans"); // Silme başarılı olunca planlar listesine geri dön
        router.refresh();
      } else {
        alert("Plan silinirken bir hata oluştu.");
        setIsDeleting(false);
      }
    } catch (e) {
      console.error(e);
      setIsDeleting(false);
    }
  };

  return (
    <button 
      onClick={handleDelete}
      disabled={isDeleting}
      className="p-2 border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white rounded-md transition-all disabled:opacity-50 flex items-center justify-center"
      title="Planı Sil"
    >
      {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
    </button>
  );
}
