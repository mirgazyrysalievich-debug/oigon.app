const recordButton = document.getElementById("recordButton");
const downloadButton = document.getElementById("downloadButton");
const reportButton = document.getElementById("reportButton");
const statusText = document.getElementById("statusText");
const errorText = document.getElementById("errorText");
const reportMessage = document.getElementById("reportMessage");
const liveVideo = document.getElementById("liveVideo");
const playbackVideo = document.getElementById("playbackVideo");
const livePlaceholder = document.getElementById("livePlaceholder");
const playbackPlaceholder = document.getElementById("playbackPlaceholder");

let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordedBlob = null;
let recordStartTime = null;
let downloadUrl = null;

const supportsMediaRecorder = () => typeof MediaRecorder !== "undefined";

const setStatus = (message) => {
  statusText.textContent = message;
};

const setError = (message) => {
  errorText.textContent = message;
};

const resetReportMessage = () => {
  reportMessage.textContent = "";
  reportMessage.classList.remove("visible");
};

const showReportMessage = (message) => {
  reportMessage.textContent = message;
  reportMessage.classList.add("visible");
};

const updatePlaceholders = () => {
  livePlaceholder.style.display = liveVideo.srcObject ? "none" : "block";
  playbackPlaceholder.style.display = playbackVideo.src ? "none" : "block";
};

const cleanupStream = () => {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  liveVideo.srcObject = null;
  updatePlaceholders();
};

const cleanupDownload = () => {
  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl);
    downloadUrl = null;
  }
};

const resetRecordingState = () => {
  recordedChunks = [];
  recordedBlob = null;
  recordStartTime = null;
  cleanupDownload();
  playbackVideo.removeAttribute("src");
  playbackVideo.load();
  updatePlaceholders();
  downloadButton.disabled = true;
  reportButton.disabled = true;
  resetReportMessage();
};

const startRecording = async () => {
  setError("");
  resetReportMessage();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setError("Ваш браузер не поддерживает доступ к камере.");
    return;
  }

  if (!supportsMediaRecorder()) {
    setError("Ваш браузер не поддерживает запись видео.");
    return;
  }

  try {
    cleanupStream();
    resetRecordingState();

    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: true,
    });

    liveVideo.srcObject = mediaStream;
    updatePlaceholders();

    const options = {};
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
      options.mimeType = "video/webm;codecs=vp9,opus";
    } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
      options.mimeType = "video/webm;codecs=vp8,opus";
    }

    mediaRecorder = new MediaRecorder(mediaStream, options);
    recordedChunks = [];
    recordStartTime = Date.now();

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener("stop", () => {
      recordedBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
      downloadUrl = URL.createObjectURL(recordedBlob);
      playbackVideo.src = downloadUrl;
      playbackVideo.load();
      updatePlaceholders();

      downloadButton.disabled = false;
      reportButton.disabled = false;
      setStatus("Видео готово. Можно скачать или отправить отчёт.");
      recordButton.textContent = "Снять видео";
      cleanupStream();
    });

    mediaRecorder.start();
    setStatus("Идёт запись... Нажмите «Стоп», чтобы завершить.");
    recordButton.textContent = "Стоп";
  } catch (error) {
    let message = "Не удалось получить доступ к камере.";
    if (error && error.name) {
      if (error.name === "NotAllowedError" || error.name === "SecurityError") {
        message = "Доступ к камере запрещён. Разрешите доступ и попробуйте снова.";
      } else if (error.name === "NotFoundError") {
        message = "Камера или микрофон не найдены.";
      } else if (error.name === "NotReadableError") {
        message = "Камера уже используется другим приложением.";
      } else if (error.name === "OverconstrainedError") {
        message = "Запрошенные параметры камеры недоступны.";
      }
    }

    if (location.protocol !== "https:" && location.hostname !== "localhost") {
      message = "Запись видео доступна только на HTTPS или localhost.";
    }

    setError(message);
    setStatus("Не удалось начать запись. Проверьте настройки браузера.");
    cleanupStream();
  }
};

const stopRecording = () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
};

const handleRecordButton = async () => {
  if (!supportsMediaRecorder()) {
    setError("Ваш браузер не поддерживает запись видео.");
    return;
  }

  if (mediaRecorder && mediaRecorder.state === "recording") {
    stopRecording();
    return;
  }

  await startRecording();
};

const handleDownload = () => {
  if (!recordedBlob) {
    return;
  }

  const fileExtension = recordedBlob.type.includes("webm") ? "webm" : "mp4";
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = `oigon-report.${fileExtension}`;
  anchor.click();
};

const handleReport = () => {
  if (!recordedBlob) {
    return;
  }

  const durationSeconds = recordStartTime
    ? Math.max(1, Math.round((Date.now() - recordStartTime) / 1000))
    : 0;
  console.info("Отчёт (демо):", {
    size: recordedBlob.size,
    durationSeconds,
  });

  showReportMessage(
    "Отчёт подготовлен (демо). На следующем этапе подключим бота/сервер."
  );
};

recordButton.addEventListener("click", handleRecordButton);
downloadButton.addEventListener("click", handleDownload);
reportButton.addEventListener("click", handleReport);

window.addEventListener("beforeunload", () => {
  cleanupStream();
  cleanupDownload();
});

updatePlaceholders();
setStatus("Готово к записи. Нажмите «Снять видео».");
