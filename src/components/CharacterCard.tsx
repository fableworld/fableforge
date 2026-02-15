import { useNavigate } from "react-router-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Music } from "lucide-react";
import type { Character } from "@/lib/schemas";
import styles from "./CharacterCard.module.css";

interface CharacterCardProps {
  character: Character;
}

export function CharacterCard({ character }: CharacterCardProps) {
  const navigate = useNavigate();

  return (
    <article
      className={styles.card}
      onClick={() => navigate(`/character/${character.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/character/${character.id}`);
        }
      }}
    >
      <div className={styles.imageWrapper}>
        <img
          className={styles.image}
          src={
            character.preview_image
              ? character.preview_image.startsWith("/") || character.preview_image.includes(":") 
                ? character.preview_image.startsWith("/") ? convertFileSrc(character.preview_image) : character.preview_image
                : character.preview_image
              : "/logo.png"
          }
          alt={character.name}
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/logo.png";
          }}
        />
      </div>
      <div className={styles.info}>
        <div className={styles.name} title={character.name}>
          {character.name}
        </div>
        <div className={styles.meta}>
          {character.tracks.length > 0 && (
            <span className={styles.trackCount}>
              <Music size={11} />
              {character.tracks.length}
            </span>
          )}
          {character.description && (
            <span>
              {character.description.length > 40
                ? character.description.slice(0, 40) + "…"
                : character.description}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function CharacterCardSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonImage} />
      <div className={styles.skeletonText} />
      <div className={styles.skeletonMeta} />
    </div>
  );
}
