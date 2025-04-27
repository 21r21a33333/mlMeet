import { useState } from "react";
import html2canvas from "html2canvas";

interface FloatingButtonProps {
  onCapture: (img: string) => void;
}

export default function FloatingButton({ onCapture }: FloatingButtonProps) {
  const captureScreen = async () => {
    try {
      // Capture the entire document
      const canvas = await html2canvas(document.documentElement, {
        allowTaint: true,
        useCORS: true,
        scrollY: -window.scrollY,
        height: document.documentElement.scrollHeight,
        windowHeight: document.documentElement.scrollHeight
      });
      
      const imageUrl = canvas.toDataURL("image/jpg");
      onCapture(imageUrl);
    } catch (error) {
      console.error("Screen capture failed:", error);
    }
  };

  return (
    <button
      style={{
        position: "fixed",
        bottom: "16px",
        left: "16px",
        backgroundColor: "black",
        color: "white",
        padding: "16px",
        borderRadius: "9999px", // full/rounded
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)", // shadow-lg
        zIndex: 50,
        cursor: "pointer",
        border: "none",
        outline: "none"
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = "#2d3748"; // hover:bg-gray-800
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = "black";
      }}
      onClick={captureScreen}
    >
      📸
    </button>
  );
}