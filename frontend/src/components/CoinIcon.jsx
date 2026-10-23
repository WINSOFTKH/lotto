import React from "react";
import coinImg from "../assets/coin.png";

/**
 * 3D Gold Casino Coins Icon
 * Stack of shiny gold coins with the standing dollar coin in front, exactly matching the brand visual.
 */
export default function CoinIcon({
  className = "w-4 h-4",
  alt = "Coins",
  ...props
}) {
  return (
    <img
      src={coinImg}
      alt={alt}
      className={`inline-block select-none object-contain flex-shrink-0 align-middle ${className}`}
      loading="eager"
      draggable={false}
      {...props}
    />
  );
}
