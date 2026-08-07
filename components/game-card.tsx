import type { Card } from "@/lib/game";

export function CardFace({
  card,
  selected = false,
  small = false,
}: {
  card: Card;
  selected?: boolean;
  small?: boolean;
}) {
  const isRed = card.suit === "♥" || card.suit === "♦";

  return (
    <span
      className={`playing-card${isRed ? " red" : " black"}${selected ? " selected" : ""}${small ? " small" : ""}`}
      aria-hidden="true"
    >
      <span className="card-corner">
        <b>{card.rank}</b>
        <i>{card.suit}</i>
      </span>
      <span className="card-suit">{card.suit}</span>
      <span className="card-corner card-corner-bottom">
        <b>{card.rank}</b>
        <i>{card.suit}</i>
      </span>
    </span>
  );
}

export function CardBack({ small = false }: { small?: boolean }) {
  return (
    <span className={`card-back${small ? " small" : ""}`} aria-hidden="true">
      <span>✦</span>
    </span>
  );
}
