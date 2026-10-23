import React, { useState } from "react";
import { Building2 } from "lucide-react";

import abaLogo from "../assets/banks/aba.png";
import acledaLogo from "../assets/banks/acleda.png";
import wingLogo from "../assets/banks/wing.png";
import canadiaLogo from "../assets/banks/canadia.png";
import sathapanaLogo from "../assets/banks/sathapana.png";
import princeLogo from "../assets/banks/prince.png";
import chipmongLogo from "../assets/banks/chipmong.png";

export const BANK_METADATA = [
  {
    name: "ABA Bank (Advanced Bank of Asia)",
    shortName: "ABA Bank",
    code: "ABA",
    tagline: "Advanced Bank of Asia",
    logoSrc: abaLogo,
    bgClass: "bg-[#004B60]",
  },
  {
    name: "ACLEDA Bank Plc.",
    shortName: "ACLEDA Bank",
    code: "ACLEDA",
    tagline: "ACLEDA Bank Plc.",
    logoSrc: acledaLogo,
    bgClass: "bg-[#0F3969]",
  },
  {
    name: "Wing Bank (Cambodia) Plc",
    shortName: "Wing Bank",
    code: "WING",
    tagline: "Wing Bank Cambodia",
    logoSrc: wingLogo,
    bgClass: "bg-[#8CC63F]",
  },
  {
    name: "Canadia Bank PLC",
    shortName: "Canadia Bank",
    code: "CANADIA",
    tagline: "Canadia Bank PLC",
    logoSrc: canadiaLogo,
    bgClass: "bg-[#E31837]",
  },
  {
    name: "Sathapana Bank Plc",
    shortName: "Sathapana Bank",
    code: "SATHAPANA",
    tagline: "Sathapana Bank Plc",
    logoSrc: sathapanaLogo,
    bgClass: "bg-[#002B49]",
  },
  {
    name: "Prince Bank Plc",
    shortName: "Prince Bank",
    code: "PRINCE",
    tagline: "Prince Bank Plc",
    logoSrc: princeLogo,
    bgClass: "bg-[#182A4A]",
  },
  {
    name: "Chip Mong Commercial Bank",
    shortName: "Chip Mong Bank",
    code: "CHIPMONG",
    tagline: "Chip Mong Commercial Bank",
    logoSrc: chipmongLogo,
    bgClass: "bg-[#E30613]",
  },
];

export function getBankMeta(name = "") {
  if (!name || typeof name !== "string") return null;
  const clean = name.toLowerCase().trim();

  // Strict distinctive whole-word matching to prevent false positives (e.g. Canadia Bank or Sathapana Bank matching ABA)
  if (/\baba\b/i.test(clean) || clean === "aba" || clean.startsWith("aba ")) {
    return BANK_METADATA.find((b) => b.code === "ABA") || null;
  }
  if (/\bacleda\b/i.test(clean) || clean.includes("acleda")) {
    return BANK_METADATA.find((b) => b.code === "ACLEDA") || null;
  }
  if (/\bwing\b/i.test(clean) || clean.includes("wing")) {
    return BANK_METADATA.find((b) => b.code === "WING") || null;
  }
  if (/\bcanadia\b/i.test(clean) || clean.includes("canadia")) {
    return BANK_METADATA.find((b) => b.code === "CANADIA") || null;
  }
  if (/\bsathapana\b/i.test(clean) || clean.includes("sathapana")) {
    return BANK_METADATA.find((b) => b.code === "SATHAPANA") || null;
  }
  if (/\bprince\b/i.test(clean) || clean.includes("prince")) {
    return BANK_METADATA.find((b) => b.code === "PRINCE") || null;
  }
  if (/chip\s*mong/i.test(clean) || clean.includes("chipmong")) {
    return BANK_METADATA.find((b) => b.code === "CHIPMONG") || null;
  }

  // Exact fallback check
  const exact = BANK_METADATA.find(
    (b) => b.name.toLowerCase() === clean || b.shortName.toLowerCase() === clean
  );
  return exact || null;
}

export default function BankLogo({
  bankName = "",
  logoUrl = "",
  size = "md",
  className = "",
}) {
  const [imgError, setImgError] = useState(false);
  const meta = getBankMeta(bankName);
  const effectiveLogo = logoUrl || meta?.logoSrc;

  const sizeClasses =
    {
      sm: "w-8 h-8 rounded-lg",
      md: "w-11 h-11 rounded-xl",
      lg: "w-14 h-14 rounded-2xl",
    }[size] || "w-11 h-11 rounded-xl";

  if (!imgError && effectiveLogo) {
    return (
      <div
        className={`${sizeClasses} bg-slate-900 border border-white/10 shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0 relative ${className}`}
        title={bankName}
      >
        <img
          src={effectiveLogo}
          alt={bankName}
          className="w-full h-full object-cover rounded-[inherit]"
          onError={() => setImgError(true)}
          loading="eager"
        />
      </div>
    );
  }

  // Generate clean initials from bankName (e.g. "VB", "BIDC", "FTB")
  const words = (bankName || "BANK").trim().split(/\s+/).filter(Boolean);
  const initials =
    words.length === 1
      ? words[0].slice(0, 3).toUpperCase()
      : words
          .slice(0, 3)
          .map((w) => w[0])
          .join("")
          .toUpperCase();

  return (
    <div
      className={`${sizeClasses} bg-gradient-to-br from-indigo-600 to-purple-700 border border-indigo-400/30 shadow-md flex items-center justify-center text-white flex-shrink-0 font-black text-xs font-mono uppercase ${className}`}
      title={bankName}
    >
      {initials || <Building2 className="w-4 h-4" />}
    </div>
  );
}
