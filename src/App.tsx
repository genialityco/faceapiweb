import { theme } from "./theme";
import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import "./App.css";

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [initialized, setInitialized] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Loading models...");

  useEffect(() => {
    // Load Face-API models
    const loadModels = async () => {
      try {
        const MODEL_URL =  "./models";
        // Tiny Face Detector
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        // Expressions
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        // Gender
        await faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL);

        // Start the video stream
        startVideo();
        setLoadingStatus("Starting video...");
      } catch (error) {
        console.error(error);
        setLoadingStatus("Failed to load models!");
      }
    };

    loadModels();
  }, []);

  // Start video from webcam
  const startVideo = () => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setLoadingStatus("Detecting faces...");
          setInitialized(true);
        }
      })
      .catch((err) => {
        console.error("Error accessing webcam: ", err);
        setLoadingStatus("Webcam access error");
      });
  };

  // Main detection loop
  useEffect(() => {
    if (!initialized) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);

    let detectionInterval;

    const detectFaces = async () => {
      if (!video || !canvas) return;

      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions()
        .withAgeAndGender();

      // Resize the detected boxes and results
      const resizedDetections = faceapi.resizeResults(detections, displaySize);

      // Clear canvas before each draw
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Draw bounding boxes
      faceapi.draw.drawDetections(canvas, resizedDetections);

      // For each face, display gender and primary emotion
      resizedDetections.forEach((detection) => {
        const { x, y, height } = detection.detection.box;
        const { gender, genderProbability } = detection;
        const expressions = detection.expressions;
        const mainEmotion = Object.keys(expressions).reduce(
          (a, b) =>
            expressions[a as keyof typeof expressions] >
            expressions[b as keyof typeof expressions]
              ? a
              : b
        );

        const text = `Gender: ${gender} (${(genderProbability * 100).toFixed(1)}%) | Emotion: ${mainEmotion}`;
        const pad = 5;
        const fontSize = 14;
        context.font = `${fontSize}px Arial`;

        // Medir ancho del texto
        const textMetrics = context.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = fontSize + 8; // Altura aproximada del texto

        // Dibujar fondo
        context.fillStyle = "rgba(0, 0, 0, 0.8)";
        context.fillRect(
          x + pad - 2,
          y + height + pad,
          textWidth + 4,
          textHeight
        );

        // Dibujar texto
        context.fillStyle = "#ff007f";
        context.fillText(text, x + pad, y + height + pad + fontSize);
      });
    };

    detectionInterval = setInterval(detectFaces, 100); // Runs detection every 100ms

    return () => clearInterval(detectionInterval);
  }, [initialized]);

  return (
    <MantineProvider theme={theme}>
      <div className="App">
        <h1>Real-time Face, Gender & Emotion Detection</h1>

        {!initialized && <p className="status">{loadingStatus}</p>}
        <div className="video-container">
          <video ref={videoRef} width="640" height="480" muted />
          <canvas ref={canvasRef} width="640" height="480" />
        </div>
      </div>
    </MantineProvider>
  );
}

export default App;
