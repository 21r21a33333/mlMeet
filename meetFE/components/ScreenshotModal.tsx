"use client";
import { useDropzone } from "react-dropzone";
import { useState, useCallback, useEffect } from "react";

export default function ScreenshotModal({
  isOpen,
  onClose,
  screenshots,
  setScreenshots,
}: {
  isOpen: boolean;
  onClose: () => void;
  screenshots: string[];
  setScreenshots: (images: string[]) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [validationError, setValidationError] = useState("");

  // Reset state when modal is closed
  const handleClose = () => {
    // Reset all states
    setPrompt("");
    setResult(null);
    setValidationError("");
    setIsLoading(false);
    
    // Call the original onClose function
    onClose();
  };

  // Reset states when modal is not open
  useEffect(() => {
    if (!isOpen) {
      setPrompt("");
      setResult(null);
      setValidationError("");
      setIsLoading(false);
    }
  }, [isOpen]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const readers = acceptedFiles.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          })
      );

      Promise.all(readers).then((images) => {
        setScreenshots([...screenshots, ...images]);
      });
    },
    [screenshots, setScreenshots]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const removeScreenshot = (index: number) => {
    const updated = screenshots.filter((_, i) => i !== index);
    setScreenshots(updated);
  };

  // Convert base64 string to File object
  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const handleGenerate = async () => {
    // Clear previous validation errors
    setValidationError("");
    
    // Validate that prompt is not empty
    if (!prompt.trim()) {
      setValidationError("Please enter a prompt before generating");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Create FormData object
      const formData = new FormData();
      formData.append("prompt", prompt);
      
      // Convert base64 images to Files and append to FormData
      screenshots.forEach((screenshot, index) => {
        const file = dataURLtoFile(screenshot, `screenshot-${index}.jpg`);
        formData.append("images", file);
      });
      
      // API call configuration
      const requestOptions = {
        method: "POST",
        body: formData,
        redirect: "follow" as RequestRedirect
      };
      
      // Make the API call
      const response = await fetch("https://2d8c-183-82-8-164.ngrok-free.app/generate", requestOptions);
      const resultData = await response.json();
      
      console.log("API Response:", resultData);
      setResult(resultData);
    } catch (error) {
      console.error("Error generating content:", error);
      setResult({ response: "An error occurred while processing your request." });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const modalContainerStyle = {
    position: "fixed" as const,
    inset: 0,
    zIndex: 50,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px"
  };

  const modalStyle = {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    width: "100%",
    maxWidth: "672px",
    position: "relative" as const,
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
    color: "black"
  };

  const closeButtonStyle = {
    position: "absolute" as const,
    top: "8px",
    right: "8px",
    color: "black",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "16px"
  };

  const titleStyle = {
    fontSize: "20px",
    fontWeight: "bold",
    marginBottom: "16px"
  };

  const responseContainerStyle = {
    padding: "16px",
    fontSize: "16px",
    lineHeight: "1.5",
    whiteSpace: "pre-wrap",
    maxHeight: "70vh",
    overflowY: "auto" as const
  };

  const imageContainerStyle = {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px",
    marginBottom: "16px"
  };

  const imageThumbnailStyle = {
    position: "relative" as const,
    width: "96px",
    height: "96px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    overflow: "hidden"
  };

  const imageStyle = {
    objectFit: "cover" as const,
    width: "100%",
    height: "100%"
  };

  const removeButtonStyle = {
    position: "absolute" as const,
    top: "0",
    right: "0",
    backgroundColor: "white",
    color: "#e53e3e",
    padding: "0 4px",
    fontSize: "14px",
    border: "none",
    cursor: "pointer" 
  };

  const dropzoneStyle = {
    border: "2px dashed #ddd",
    padding: "16px",
    borderRadius: "6px",
    textAlign: "center" as const,
    cursor: "pointer",
    marginBottom: "16px"
  };

  const textareaStyle = {
    width: "100%",
    border: `1px solid ${validationError ? "#e53e3e" : "#ddd"}`,
    padding: "8px",
    borderRadius: "4px",
    marginBottom: validationError ? "4px" : "16px",
    resize: "vertical" as const
  };

  const errorMessageStyle = {
    color: "#e53e3e",
    fontSize: "14px",
    marginBottom: "16px",
    marginTop: "4px"
  };

  const buttonContainerStyle = {
    display: "flex",
    justifyContent: "space-between"
  };

  const generateButtonStyle = {
    backgroundColor: isLoading ? "#4a90e2" : "#2563eb",
    color: "white",
    padding: "8px 16px",
    borderRadius: "4px",
    border: "none",
    cursor: isLoading ? "not-allowed" : "pointer"
  };

  const linkButtonStyle = {
    fontSize: "14px",
    textDecoration: "underline",
    background: "none",
    border: "none",
    cursor: "pointer"
  };

  const doneButtonStyle = {
    backgroundColor: "#2563eb",
    color: "white",
    padding: "8px 16px",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
    margin: "16px auto 0",
    display: "block",
    width: "120px"
  };

  const loadingContainerStyle = {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 16px",
    textAlign: "center" as const
  };

  // Show only the response when result is available
  if (result && result.response) {
    return (
      <div style={modalContainerStyle}>
        <div style={modalStyle}>
          <button style={closeButtonStyle} onClick={handleClose}>✖</button>
          <div style={responseContainerStyle}>
            {result.response}
          </div>
          <button 
            style={doneButtonStyle}
            onClick={handleClose}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // Show loading indicator when API call is in progress
  if (isLoading) {
    return (
      <div style={modalContainerStyle}>
        <div style={modalStyle}>
          <div style={loadingContainerStyle}>
            <h2 style={titleStyle}>Analyzing Images...</h2>
            <p>Please wait while we process your request.</p>
          </div>
        </div>
      </div>
    );
  }

  // Default view for uploading and entering prompt
  return (
    <div style={modalContainerStyle}>
      <div style={modalStyle}>
        <button style={closeButtonStyle} onClick={handleClose}>✖</button>

        <h2 style={titleStyle}>Screenshot Captured</h2>

        <div style={imageContainerStyle}>
          {screenshots.map((src, i) => (
            <div key={i} style={imageThumbnailStyle}>
              <img src={src} alt={`Screenshot ${i}`} style={imageStyle} />
              {screenshots.length > 1 && (
                <button
                  style={removeButtonStyle}
                  onClick={() => removeScreenshot(i)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        <div
          {...getRootProps()}
          style={dropzoneStyle}
        >
          <input {...getInputProps()} />
          {isDragActive ? <p>Drop the images here ...</p> : <p>Drag & drop more images here, or click</p>}
        </div>

        <textarea
          placeholder="Enter prompt (required)..."
          style={textareaStyle}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (e.target.value.trim()) {
              setValidationError("");
            }
          }}
          rows={3}
          required
        />
        {validationError && <div style={errorMessageStyle}>{validationError}</div>}

        <div style={buttonContainerStyle}>
          <button
            style={generateButtonStyle}
            onClick={handleGenerate}
            disabled={isLoading}
          >
            Generate
          </button>
          {/* <button
            style={linkButtonStyle}
            onClick={handleClose}
          >
            Take another screenshot
          </button> */}
        </div>
      </div>
    </div>
  );
}