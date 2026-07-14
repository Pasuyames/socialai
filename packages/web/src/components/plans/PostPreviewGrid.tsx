"use client";

import { IPhoneMockup } from "react-device-mockup";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ImageOff, Sparkles } from "lucide-react";
import { BentoCard } from "@/components/ui/Bento";
import { StatusBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

export interface PostPreviewData {
  id: number;
  brandName: string;
  topic: string | null;
  hook: string | null;
  caption: string | null;
  hashtags: string | null;
  imagePath: string | null;
  storyImagePath: string | null;
  status: string;
  qualityScore: number | null;
}

function qualityTone(score: number): { text: string; bg: string; border: string } {
  if (score >= 80) return { text: "text-success", bg: "bg-success/10", border: "border-success/20" };
  if (score >= 50) return { text: "text-warning", bg: "bg-warning/10", border: "border-warning/20" };
  return { text: "text-danger", bg: "bg-danger/10", border: "border-danger/20" };
}

function avatarAccent(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hues = ["108 92 231", "0 210 255", "236 72 153", "0 230 118", "255 214 0"];
  return hues[Math.abs(hash) % hues.length];
}

function InstagramCard({ post }: { post: PostPreviewData }) {
  const accent = avatarAccent(post.brandName);
  const hashtagList = post.hashtags?.split(" ").filter(Boolean) ?? [];

  return (
    <div className="flex-1 overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: `rgb(${accent} / 0.3)`, border: `1px solid rgb(${accent} / 0.5)` }}
          >
            {post.brandName.charAt(0).toUpperCase()}
          </div>
          <p className="text-xs font-semibold text-white">{post.brandName}</p>
        </div>
        <MoreHorizontal size={16} className="text-muted-foreground" />
      </div>

      <div className="relative aspect-[4/5] w-full bg-white/[0.02]">
        {post.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.imagePath} alt={post.topic ?? "Post görseli"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center">
            <ImageOff size={26} className="text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground">Görsel henüz üretilmedi</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 px-3 pt-2.5">
        <Heart size={18} className="text-muted-foreground" />
        <MessageCircle size={18} className="text-muted-foreground" />
        <Send size={18} className="text-muted-foreground" />
        <Bookmark size={18} className="ml-auto text-muted-foreground" />
      </div>

      <div className="space-y-1.5 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        {post.caption && (
          <p className="whitespace-pre-wrap">
            <span className="font-semibold text-white">{post.brandName}</span> {post.caption}
          </p>
        )}
        {hashtagList.length > 0 && (
          <p className="flex flex-wrap gap-1">
            {hashtagList.map((tag, i) => (
              <span key={i} className="text-accent">{tag}</span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

function StoryMockup({ storyImagePath }: { storyImagePath: string }) {
  return (
    <div className="flex shrink-0 items-start justify-center" style={{ width: 180 }}>
      <IPhoneMockup screenWidth={170} screenType="island" frameColor="#26263A" hideStatusBar={false}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={storyImagePath} alt="Story görseli" className="h-full w-full object-cover" />
      </IPhoneMockup>
    </div>
  );
}

function PostPreviewCard({
  post,
  index,
  actions,
}: {
  post: PostPreviewData;
  index: number;
  actions?: React.ReactNode;
}) {
  const tone = post.qualityScore !== null ? qualityTone(post.qualityScore) : null;

  return (
    <BentoCard interactive={false} className="p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-muted-foreground">
            {index + 1}
          </span>
          <h4 className="truncate text-sm font-semibold text-white">{post.topic ?? "Başlıksız İçerik"}</h4>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {tone && (
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", tone.bg, tone.border, tone.text)}>
              {post.qualityScore}
            </span>
          )}
          <StatusBadge status={post.status} />
        </div>
      </div>

      {post.hook && (
        <p className="mb-3 text-xs italic leading-relaxed text-muted-foreground">"{post.hook}"</p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row">
        <InstagramCard post={post} />
        {post.storyImagePath && <StoryMockup storyImagePath={post.storyImagePath} />}
      </div>

      {actions && (
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          {actions}
        </div>
      )}
    </BentoCard>
  );
}

export function PostPreviewGrid({
  posts,
  actionsByPostId,
}: {
  posts: PostPreviewData[];
  actionsByPostId?: Record<number, React.ReactNode>;
}) {
  if (posts.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-[#0B0B14]/80 text-center">
        <Sparkles size={22} className="mb-2 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">Henüz içerik üretilmedi</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {posts.map((post, idx) => (
        <PostPreviewCard key={post.id} post={post} index={idx} actions={actionsByPostId?.[post.id]} />
      ))}
    </div>
  );
}
