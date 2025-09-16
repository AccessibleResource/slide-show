document.addEventListener("DOMContentLoaded", () => {
  const imageUpload = document.getElementById("imageUpload");
  const imageListDiv = document.getElementById("imageList");
  const imageMinous = document.getElementById("minousbtn");
  const imagePlus = document.getElementById("plusbtn");
  const musicMinous = document.getElementById("musicminousbtn");
  const musicPlus = document.getElementById("musicplusbtn");
  const fadeMinous = document.getElementById("fademinousbtn");
  const fadePlus = document.getElementById("fadeplusbtn");
  const videoPlayer = document.getElementById("videoPlayer");
  const imageError = document.getElementById("imageError");
  const durationSelect = document.getElementById("durationSelect");
  const totalDurationSpan = document.getElementById("totalDuration");
  const durationWarning = document.getElementById("durationWarning");
  const noMusicCheckbox = document.getElementById("noMusicCheckbox");
  const musicUploadSection = document.getElementById("musicUploadSection");
  const musicUpload = document.getElementById("musicUpload");
  const musicFileNameDiv = document.getElementById("musicFileName");
  const audioError = document.getElementById("audioError");
  const createVideoButton = document.getElementById("createVideoButton");
  const generalError = document.getElementById("generalError");
  const setupForm = document.getElementById("setup-form");
  const processingArea = document.getElementById("processingArea");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const resultsArea = document.getElementById("resultsArea");
  const downloadLink = document.getElementById("downloadLink");
  const createAnotherButton = document.getElementById("createAnotherButton");
  const renderCanvas = document.getElementById("renderCanvas");
  const ctx = renderCanvas.getContext("2d");
  const initialUploadLabel = document.getElementById("initialUploadLabel");
  const imageManagementSection = document.getElementById("imageManagementSection");
  const imageCountSpan = document.getElementById("imageCount");
  const addMoreImagesButton = document.getElementById("addMoreImagesButton");
  const removeAllImagesButton = document.getElementById("removeAllImagesButton");
  const audioOptionsDiv = document.getElementById("audioOptions");
  const audioStartTimeInput = document.getElementById("audioStartTime");
  const audioActualDurationSpan = document.getElementById("audioActualDuration");
  const audioTimeError = document.getElementById("audioTimeError");
  const audioInfoSpan = document.getElementById("audioInfo");
  const audioFadeTimeInput = document.getElementById("audioFadeTime");

  let uploadedImages = [];
  let uploadedAudio = null;
  let durationPerImage = parseInt(durationSelect.value, 10) || 3;
  let calculatedTotalDuration = 0;
  let mediaRecorder = null;
  let recordedChunks = [];
  let audioContext = null;
  let audioBufferSource = null;
  let audioGainNode = null;
  let audioDestinationNode = null;
  let startTime = 0;
  let animationFrameId = null;
  let outputMimeType = "video/webm";
  let outputExtension = "webm";
  let desiredAudioStartTime = 0;
  let audioFadeDuration = parseFloat(audioFadeTimeInput.value) || 1;

  const MAX_VIDEO_DURATION = 60;
  const FRAME_RATE = 30;

  clearErrors();
  updateCreateButtonState();
  updateAudioOptionsVisibility();
  updateImageManagementUI();

  imageUpload.addEventListener("change", handleImageUpload);
  durationSelect.addEventListener("input", handleDurationChange);
  noMusicCheckbox.addEventListener("change", handleNoMusicToggle);
  musicUpload.addEventListener("change", handleMusicUpload);
  audioStartTimeInput.addEventListener("input", handleAudioStartTimeChange);
  audioFadeTimeInput.addEventListener("input", handleAudioFadeTimeChange);
  addMoreImagesButton.addEventListener("click", () => imageUpload.click());
  removeAllImagesButton.addEventListener("click", handleRemoveAllImages);
  createVideoButton.addEventListener("click", startVideoCreation);
  createAnotherButton.addEventListener("click", resetForm);
  imageListDiv.addEventListener("click", handleImageRemoveClick);

  function handleInputChange(inputID, minusID, plusID, min, max) {
    let input = document.getElementById(inputID);
    let plus = document.getElementById(plusID);
    let minus = document.getElementById(minusID);

    const update = () => {
      input.value = Math.max(min, Math.min(max, Number(input.value) || min));
      minus.disabled = input.value <= min;
      plus.disabled = input.value >= max;
      handleDurationChange();
    };

    minus.replaceWith(minus.cloneNode(true));
    plus.replaceWith(plus.cloneNode(true));
    minus = document.getElementById(minusID);
    plus = document.getElementById(plusID);

    minus.addEventListener('click', (event) => {
      input.value--;
      update();
      event.preventDefault();
      setTimeout(() => {
        const latestMinus = document.getElementById(minusID);
        if (latestMinus) {
          latestMinus.focus({ preventScroll: true });
        }
      }, 0);
    });

    plus.addEventListener('click', (event) => {
      input.value++;
      update();
      event.preventDefault();
      setTimeout(() => {
        const latestPlus = document.getElementById(plusID);
        if (latestPlus) {
          latestPlus.focus({ preventScroll: true });
        }
      }, 0);
    });

    input.addEventListener('input', update);
    update();
  }

  handleInputChange("durationSelect", "minousbtn", "plusbtn", 1, 60);
  handleInputChange("audioStartTime", "musicminousbtn", "musicplusbtn", 0, 0);
  handleInputChange("audioFadeTime", "fademinousbtn", "fadeplusbtn", 0, 0);

  async function handleImageUpload(event) {
    console.log("handleImageUpload triggered.");
    clearErrors();
    const files = Array.from(event.target.files);
    console.log("Files selected:", files.length);

    if (files.length === 0) {
      console.log("No files selected.");
      return;
    }

    const placeholder = imageListDiv.querySelector(".placeholder-text");
    if (placeholder) placeholder.remove();

    let loadingIndicator = document.getElementById("loading-indicator");
    if (!loadingIndicator) {
      loadingIndicator = document.createElement("p");
      loadingIndicator.setAttribute("role", "alert");
      loadingIndicator.textContent = "🎨 Loading your media... Please wait!";
      loadingIndicator.className = "text-blue-600 font-semibold animate-pulse";
      loadingIndicator.id = "loading-indicator";
      imageListDiv.appendChild(loadingIndicator);
    }

    let loadPromises = [];
    const existingFilenames = new Set(uploadedImages.map(img => img.file.name));

    files.forEach((file, index) => {
      if (!file.type.startsWith("image/")) {
        console.warn(`Skipping non-image file: ${file.name}`);
        displayError(imageError, `⚠️ Skipped non-image file: ${file.name}`);
        return;
      }

      if (existingFilenames.has(file.name)) {
        console.warn(`Skipping duplicate filename: ${file.name}`);
        return;
      }

      const uniqueId = `image-${Date.now()}-${index}`;
      const promise = new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => resolve({
            id: uniqueId, file: file, objectURL: e.target.result,
            imageElement: img, width: img.naturalWidth, height: img.naturalHeight
          });
          img.onerror = (err) => reject({ id: uniqueId, file: file, error: `Error loading image: ${file.name}` });
          img.src = e.target.result;
        };
        reader.onerror = (err) => reject({ id: uniqueId, file: file, error: `Error reading file: ${file.name}` });
        reader.readAsDataURL(file);
      });
      loadPromises.push(promise);
    });

    const results = await Promise.allSettled(loadPromises);
    let newImagesAdded = 0;

    results.forEach(result => {
      if (result.status === "fulfilled") {
        const imgData = result.value;
        if (!uploadedImages.some(img => img.id === imgData.id)) {
          uploadedImages.push(imgData);
          existingFilenames.add(imgData.file.name);
          createImagePreviewElement(imgData);
          newImagesAdded++;
        }
      } else {
        const reason = result.reason;
        console.error(`Image load failed: ${reason?.file?.name || "unknown"}`, reason?.error || reason);
        displayError(imageError, `🚫 Failed to load image: ${reason?.file?.name || "unknown"}`);
      }
    });

    console.log(`${newImagesAdded} new images processed and potentially added.`);
    console.log("Current uploadedImages count:", uploadedImages.length);

    if (loadingIndicator) loadingIndicator.remove();
    if (files.length > 0) {
      event.target.value = null;
    }

    updateTotalDuration();
    updateCreateButtonState();
    updateImageManagementUI();
  }

  async function handleMusicUpload(event) {
    clearErrors();
    const file = event.target.files[0];

    if (uploadedAudio?.objectURL?.startsWith("blob:")) {
      URL.revokeObjectURL(uploadedAudio.objectURL);
    }

    uploadedAudio = null;
    musicFileNameDiv.textContent = "";
    audioActualDurationSpan.textContent = "--";
    audioStartTimeInput.value = 0;
    desiredAudioStartTime = 0;
    audioFadeTimeInput.value = 1;
    audioFadeDuration = 1;
    updateAudioOptionsVisibility();

    if (file) {
      if (!file.type.startsWith("audio/")) {
        displayError(audioError, "🎵 Invalid audio format! Please upload a valid audio file.");
        musicUpload.value = "";
        updateCreateButtonState();
        return;
      }

      const objectURL = URL.createObjectURL(file);
      uploadedAudio = { file: file, objectURL: objectURL, audioBuffer: null, duration: null };
      musicFileNameDiv.innerHTML = `<p class="text-green-600">🎉 Audio Selected: ${file.name}</p>`;
      await loadAndValidateAudioBuffer();
    } else {
      musicFileNameDiv.textContent = "";
    }

    updateCreateButtonState();
  }

  async function startVideoCreation() {
    console.log("Starting video creation process...");
    clearErrors();
    progressBar.style.display = "none";
    progressText.textContent = "";

    if (uploadedImages.length === 0) {
      displayError(generalError, "🖼️ Please upload at least one image to create a video!");
      return;
    }

    if (calculatedTotalDuration <= 0 || calculatedTotalDuration > MAX_VIDEO_DURATION) {
      displayError(generalError, `⏱️ Video duration must be between 1 and ${MAX_VIDEO_DURATION} seconds!`);
      return;
    }

    if (!noMusicCheckbox.checked && !uploadedAudio) {
      displayError(generalError, "🎶 Please upload an audio file or select 'No Music'!");
      return;
    }

    let startTimeValid = true, fadeTimeValid = true, audioValid = true;
    if (!noMusicCheckbox.checked && uploadedAudio) {
      audioValid = await loadAndValidateAudioBuffer();
      startTimeValid = validateAudioStartTime();
      fadeTimeValid = validateFadeTime();

      if (!audioValid || !uploadedAudio.audioBuffer || !startTimeValid || !fadeTimeValid) {
        displayError(generalError, "⚠️ Please resolve configuration errors before proceeding!");
        return;
      }
    }

    console.log("Validation passed.");
    setupForm.style.display = "none";
    processingArea.style.display = "block";
    resultsArea.style.display = "none";
    recordedChunks = [];

    console.log("UI updated for processing.");
    let canvasWidth = 640, canvasHeight = 480;
    if (uploadedImages.length > 0) {
      const firstImage = uploadedImages[0];
      canvasWidth = Math.min(firstImage.width, 1920);
      canvasHeight = Math.round(canvasWidth * (firstImage.height / firstImage.width));
      if (canvasHeight > 1080) {
        canvasHeight = 1080;
        canvasWidth = Math.round(canvasHeight * (firstImage.width / firstImage.height));
      }
    }

    renderCanvas.width = canvasWidth;
    renderCanvas.height = canvasHeight;
    console.log(`Canvas prepared: ${renderCanvas.width}x${renderCanvas.height}`);

    let audioStream = null; audioGainNode = null; audioBufferSource = null;
    if (!noMusicCheckbox.checked && uploadedAudio?.audioBuffer) {
      try {
        if (!audioContext || audioContext.state !== "running") {
          if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
          if (audioContext.state === "suspended") await audioContext.resume();
          if (audioContext.state !== "running") throw new Error("AudioContext failed to start.");
        }

        audioBufferSource = audioContext.createBufferSource();
        audioBufferSource.buffer = uploadedAudio.audioBuffer;
        audioBufferSource.loop = true;
        audioBufferSource.loopStart = Math.max(0, Math.min(desiredAudioStartTime, uploadedAudio.duration - 0.001));
        audioBufferSource.loopEnd = uploadedAudio.duration;
        audioGainNode = audioContext.createGain();
        audioGainNode.gain.value = 0;
        audioBufferSource.connect(audioGainNode);
        if (!audioDestinationNode) audioDestinationNode = audioContext.createMediaStreamDestination();
        audioGainNode.connect(audioDestinationNode);
        audioStream = audioDestinationNode.stream;
        console.log(`Audio stream prepared successfully.`);
      } catch (error) {
        console.error("Error preparing audio stream:", error);
        displayError(generalError, `🎵 Audio preparation failed: ${error.message}. Proceeding without audio.`);
        noMusicCheckbox.checked = true;
        audioStream = null;
        audioBufferSource = null;
        audioGainNode = null;
      }
    } else {
      console.log("Audio not requested or not ready.");
    }

    console.log("Preparing MediaStream...");
    const canvasStream = renderCanvas.captureStream(FRAME_RATE);
    const videoTrack = canvasStream.getVideoTracks()[0];

    if (!videoTrack) {
      console.error("FATAL: Could not get video track!");
      displayError(generalError, "🚨 Internal error: Failed to capture video!");
      processingArea.style.display = "none";
      setupForm.style.display = "block";
      return;
    }

    let combinedStream = null;
    const audioTrack = audioStream?.getAudioTracks()[0];
    if (audioTrack) {
      combinedStream = new MediaStream([videoTrack, audioTrack]);
      console.log("Combined video and audio stream created.");
    } else {
      combinedStream = new MediaStream([videoTrack]);
      console.log("Using video-only stream.");
    }

    if (!combinedStream || combinedStream.getTracks().length === 0) {
      console.error("FATAL: Failed MediaStream creation.");
      displayError(generalError, "🚨 Internal error creating media stream!");
      processingArea.style.display = "none";
      setupForm.style.display = "block";
      canvasStream.getTracks().forEach(track => track.stop());
      return;
    }

    console.log("Setting up MediaRecorder...");
    mediaRecorder = null;
    try {
      const mimeTypes = [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4;codecs=avc1.64001F,mp4a.40.2",
        "video/mp4;codecs=h264,aac",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm"
      ];
      let supportedMimeType = mimeTypes.find(mime => MediaRecorder.isTypeSupported(mime)) || "";
      if (!supportedMimeType) throw new Error("No suitable recording format supported (MP4/WebM).");

      outputMimeType = supportedMimeType;
      outputExtension = outputMimeType.includes("mp4") ? "mp4" : "webm";
      console.log(`Attempting MediaRecorder with type: ${outputMimeType}`);
      mediaRecorder = new MediaRecorder(combinedStream, { mimeType: outputMimeType });
      console.log("MediaRecorder created:", mediaRecorder);
    } catch (error) {
      console.error("MediaRecorder setup failed:", error);
      displayError(generalError, `🚨 Recorder initialization failed: ${error.message}`);
      processingArea.style.display = "none";
      setupForm.style.display = "block";
      combinedStream.getTracks().forEach(track => track.stop());
      if (audioBufferSource) {
        audioBufferSource.stop(0);
        audioBufferSource.disconnect();
      }
      if (audioGainNode) {
        audioGainNode.disconnect();
      }
      return;
    }

    if (!mediaRecorder) {
      console.error("FATAL: MediaRecorder null after init block.");
      displayError(generalError, "🚨 Internal recorder error!");
      processingArea.style.display = "none";
      setupForm.style.display = "block";
      combinedStream.getTracks().forEach(track => track.stop());
      return;
    }

    console.log("Assigning MediaRecorder handlers...");
    mediaRecorder.ondataavailable = (event) => {
      if (event.data?.size > 0) recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      console.log("MediaRecorder \"onstop\" event.");
      progressText.textContent = "✨ Finalizing your stunning slideshow...";
      if (audioBufferSource) {
        try {
          audioBufferSource.stop(0);
        } catch (e) {}
        audioBufferSource.disconnect();
        audioBufferSource = null;
      }
      if (audioGainNode) {
        audioGainNode.disconnect();
        audioGainNode = null;
      }
      combinedStream.getTracks().forEach(track => track.stop());

      if (recordedChunks.length === 0) {
        console.error("No data recorded.");
        displayError(generalError, "🚫 Recording failed: No data captured!");
        processingArea.style.display = "none";
        setupForm.style.display = "block";
        return;
      }

      console.log(`Creating blob from ${recordedChunks.length} chunks.`);
      const blob = new Blob(recordedChunks, { type: outputMimeType });
      const videoURL = URL.createObjectURL(blob);

      downloadLink.addEventListener("click", () => {
        const a = document.createElement("a");
        a.href = videoURL;
        a.download = `tech-assistant-for-blind_slideshow_${new Date().toLocaleDateString()}_${new Date().toLocaleTimeString()}.${outputExtension}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });

      videoPlayer.src = videoURL;
      videoPlayer.controls = true;
      processingArea.style.display = "none";
      resultsArea.style.display = "block";
      console.log("Video processing complete.");
      recordedChunks = [];
      mediaRecorder = null;
      animationFrameId = null;
    };

    mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder \"onerror\" event:", event.error);
      displayError(generalError, `🚨 Recording error: ${event.error.name || "Unknown"}`);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      if (audioBufferSource) {
        try {
          audioBufferSource.stop(0);
        } catch (e) {}
        audioBufferSource.disconnect();
        audioBufferSource = null;
      }
      if (audioGainNode) {
        audioGainNode.disconnect();
        audioGainNode = null;
      }
      combinedStream.getTracks().forEach(track => track.stop());
      processingArea.style.display = "none";
      setupForm.style.display = "block";
      mediaRecorder = null;
    };

    console.log("Attempting to start recording and animation...");
    try {
      mediaRecorder.start();
      console.log("MediaRecorder started.");
      startTime = performance.now();
      const contextTimeNow = audioContext?.currentTime || 0;

      if (audioBufferSource && audioGainNode && audioContext && calculatedTotalDuration > 0) {
        const fadeTime = audioFadeDuration;
        const videoEndTime = contextTimeNow + calculatedTotalDuration;
        let fadeInEndTime = contextTimeNow + Math.min(fadeTime, calculatedTotalDuration / 2);
        let fadeOutStartTime = videoEndTime - Math.min(fadeTime, calculatedTotalDuration / 2);

        if (fadeOutStartTime < fadeInEndTime) {
          console.warn("Fade times overlap significantly - adjusting");
          const halfDuration = calculatedTotalDuration / 2;
          fadeInEndTime = contextTimeNow + halfDuration;
          fadeOutStartTime = contextTimeNow + halfDuration;
        }

        audioGainNode.gain.setValueAtTime(0, contextTimeNow);
        if (fadeTime > 0) audioGainNode.gain.linearRampToValueAtTime(1, fadeInEndTime);
        else audioGainNode.gain.setValueAtTime(1, contextTimeNow);
        if (fadeTime > 0 && fadeOutStartTime < videoEndTime) {
          audioGainNode.gain.setValueAtTime(1, fadeOutStartTime);
          audioGainNode.gain.linearRampToValueAtTime(0, videoEndTime);
        } else if (fadeTime === 0) audioGainNode.gain.setValueAtTime(0, videoEndTime);
        audioBufferSource.start(contextTimeNow, desiredAudioStartTime);
        console.log("Audio playback started with fades scheduled.");
      } else if (audioBufferSource && audioDestinationNode) {
        console.warn("Playing audio source directly without fades.");
        audioBufferSource.connect(audioDestinationNode);
        audioBufferSource.start(contextTimeNow, desiredAudioStartTime);
      }

      progressBar.style.display = "block";
      progressBar.value = 0;
      progressBar.max = calculatedTotalDuration * 1000;
      progressText.textContent = "🎥 Encoding your masterpiece: Frame 1...";
      animationFrameId = requestAnimationFrame(animateCanvas);
      console.log("Animation loop started.");
    } catch (error) {
      console.error("Error starting MediaRecorder or audio:", error);
      displayError(generalError, `🚨 Failed to start recording: ${error.message}`);
      processingArea.style.display = "none";
      setupForm.style.display = "block";
      combinedStream.getTracks().forEach(track => track.stop());
      if (audioBufferSource) {
        audioBufferSource.stop(0);
        audioBufferSource.disconnect();
      }
      if (audioGainNode) {
        audioGainNode.disconnect();
      }
      mediaRecorder = null;
    }
  }

  function animateCanvas(timestamp) {
    if (!mediaRecorder || mediaRecorder.state !== "recording") {
      console.warn("animateCanvas called but recorder not recording. Stopping.", mediaRecorder?.state);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      return;
    }

    const elapsedTimeMs = performance.now() - startTime;
    const elapsedTime = elapsedTimeMs / 1000;
    progressBar.value = Math.round((elapsedTimeMs / (calculatedTotalDuration * 1000)) * 100);

    if (elapsedTime >= calculatedTotalDuration) {
      if (mediaRecorder.state === "recording") {
        console.log("Time limit reached. Stopping recorder.");
        try {
          mediaRecorder.stop();
        } catch (e) {
          console.error("Error stopping MediaRecorder:", e);
        }
      }
      animationFrameId = null;
      progressText.textContent = "🎬 Wrapping up final frames...";
      console.log("Animation loop finished by time limit.");
      return;
    }

    const imageIndex = Math.min(Math.floor(elapsedTime / durationPerImage), uploadedImages.length - 1);
    const currentImage = uploadedImages[imageIndex]?.imageElement;

    if (currentImage) {
      ctx.clearRect(0, 0, renderCanvas.width, renderCanvas.height);
      drawImageProp(ctx, currentImage, 0, 0, renderCanvas.width, renderCanvas.height);
    } else {
      console.warn(`Image ${imageIndex+1} not found at time ${elapsedTime.toFixed(1)}s.`);
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);
    }

    if (Math.floor(elapsedTime * 10) % 5 === 0) {
      progressText.textContent = `🌟 Encoding: ${elapsedTime.toFixed(1)}s / ${calculatedTotalDuration}s (Image ${imageIndex + 1}/${uploadedImages.length})`;
    }

    if (mediaRecorder.state === "recording") {
      animationFrameId = requestAnimationFrame(animateCanvas);
    } else {
      console.log("Animation loop stopping because recorder state is:", mediaRecorder.state);
      animationFrameId = null;
    }
  }

  function drawImageProp(ctx, img, x, y, w, h) {
    if (!img || !img.naturalWidth) return;
    const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const sw = img.naturalWidth * scale;
    const sh = img.naturalHeight * scale;
    const dx = x + (w - sw) / 2;
    const dy = y + (h - sh) / 2;
    ctx.drawImage(img, dx, dy, sw, sh);
  }

  function resetForm() {
    setupForm.style.display = "block";
    processingArea.style.display = "none";
    resultsArea.style.display = "none";
    imageUpload.value = "";
    durationSelect.value = "3";
    noMusicCheckbox.checked = false;
    musicUploadSection.style.display = "block";
    musicUpload.value = "";
    audioFadeTimeInput.value = 1;
    musicFileNameDiv.textContent = "";
    clearErrors();
    audioOptionsDiv.style.display = "none";
    audioStartTimeInput.value = 0;
    audioStartTimeInput.disabled = true;
    audioFadeTimeInput.disabled = true;
    audioActualDurationSpan.textContent = "--";
    if (uploadedAudio?.objectURL?.startsWith("blob:")) URL.revokeObjectURL(uploadedAudio.objectURL);
    uploadedImages.forEach((img) => {
      if (img.objectURL?.startsWith("blob:")) URL.revokeObjectURL(img.objectURL);
    });
    uploadedImages = [];
    uploadedAudio = null;
    durationPerImage = 3;
    calculatedTotalDuration = 0;
    mediaRecorder = null;
    recordedChunks = [];
    if (audioBufferSource) {
      try {
        audioBufferSource.stop(0);
      } catch (e) {}
      audioBufferSource.disconnect();
    }
    if (audioGainNode) {
      audioGainNode.disconnect();
    }
    audioBufferSource = null;
    audioGainNode = null;
    desiredAudioStartTime = 0;
    audioFadeDuration = 1;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    updateTotalDuration();
    updateCreateButtonState();
    updateAudioOptionsVisibility();
    updateImageManagementUI();
    console.log("Form reset.");
  }

  function clearErrors() {
    imageError.textContent = "";
    audioError.textContent = "";
    generalError.textContent = "";
    durationWarning.textContent = "";
    audioTimeError.textContent = "";
  }

  function displayError(element, message) {
    element.innerHTML = `<span class="text-red-500 font-bold animate-pulse">${message}</span>`;
  }

  function updateAudioOptionsVisibility() {
    const show = !noMusicCheckbox.checked && uploadedAudio?.audioBuffer;
    audioOptionsDiv.style.display = show ? "block" : "none";
    audioStartTimeInput.disabled = !show;
    audioFadeTimeInput.disabled = !show;
  }

  function updateImageManagementUI() {
    const hasImages = uploadedImages.length > 0;
    imageManagementSection.style.display = hasImages ? "block" : "none";
    initialUploadLabel.style.display = hasImages ? "none" : "block";
    imageCountSpan.textContent = uploadedImages.length;
    const placeholder = imageListDiv.querySelector(".placeholder-text");
    if (hasImages && placeholder) {
      placeholder.remove();
    } else if (!hasImages && !placeholder) {
      imageListDiv.innerHTML = `<p class="placeholder-text text-gray-500">📷 No images uploaded yet. Add some to start!</p>`;
    }
  }

  function createImagePreviewElement(imgData) {
    const previewItem = document.createElement("div");
    previewItem.className = "image-preview-item";
    previewItem.dataset.imageId = imgData.id;
    const imgElement = document.createElement("img");
    imgElement.src = imgData.objectURL;
    imgElement.alt = `Preview of ${imgData.file.name}`;
    imgElement.title = `${imgData.file.name} (${imgData.width}x${imgData.height})`;
    const nameSpan = document.createElement("span");
    nameSpan.textContent = imgData.file.name;
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-image-btn bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center";
    removeBtn.textContent = "×";
    removeBtn.setAttribute("aria-label", "Remove image");
    removeBtn.dataset.action = "remove-image";
    previewItem.appendChild(removeBtn);
    previewItem.appendChild(imgElement);
    previewItem.appendChild(nameSpan);
    imageListDiv.appendChild(previewItem);
  }

  function handleImageRemoveClick(event) {
    const target = event.target;
    if (target.dataset.action === "remove-image") {
      const previewItem = target.closest(".image-preview-item");
      if (previewItem?.dataset.imageId) {
        const imageIdToRemove = previewItem.dataset.imageId;
        const indexToRemove = uploadedImages.findIndex(img => img.id === imageIdToRemove);
        if (indexToRemove > -1) {
          const removed = uploadedImages.splice(indexToRemove, 1);
          if (removed[0]?.objectURL?.startsWith("blob:")) URL.revokeObjectURL(removed[0].objectURL);
          console.log("Removed image:", imageIdToRemove);
          previewItem.remove();
          updateTotalDuration();
          updateCreateButtonState();
          updateImageManagementUI();
        }
      }
    }
  }

  function handleRemoveAllImages() {
    uploadedImages.forEach(img => {
      if (img.objectURL?.startsWith("blob:")) URL.revokeObjectURL(img.objectURL);
    });
    uploadedImages = [];
    updateTotalDuration();
    updateCreateButtonState();
    updateImageManagementUI();
  }

  function handleDurationChange() {
    clearErrors();
    durationPerImage = parseInt(durationSelect.value, 10) || 1;
    if (durationPerImage > MAX_VIDEO_DURATION) {
      durationPerImage = MAX_VIDEO_DURATION;
      durationSelect.value = MAX_VIDEO_DURATION;
    }
    updateTotalDuration();
    updateCreateButtonState();
  }

  function handleNoMusicToggle() {
    clearErrors();
    const isChecked = noMusicCheckbox.checked;
    musicUploadSection.style.display = isChecked ? "none" : "block";
    if (isChecked) {
      if (uploadedAudio?.objectURL?.startsWith("blob:")) URL.revokeObjectURL(uploadedAudio.objectURL);
      uploadedAudio = null;
      musicUpload.value = "";
      musicFileNameDiv.textContent = "";
      audioError.textContent = "";
      desiredAudioStartTime = 0;
      audioStartTimeInput.value = 0;
      audioFadeTimeInput.value = 1;
      audioFadeDuration = 1;
    }
    updateAudioOptionsVisibility();
    updateCreateButtonState();
  }

  function updateTotalDuration() {
    calculatedTotalDuration = uploadedImages.length * durationPerImage;
    totalDurationSpan.textContent = calculatedTotalDuration;
    durationWarning.textContent = calculatedTotalDuration > MAX_VIDEO_DURATION ? `⚠️ Duration exceeds max limit of ${MAX_VIDEO_DURATION}s!` : "";
    validateFadeTime();
    updateCreateButtonState();
  }

  function updateCreateButtonState() {
    const imagesPresent = uploadedImages.length > 0;
    const durationValid = calculatedTotalDuration > 0 && calculatedTotalDuration <= MAX_VIDEO_DURATION;
    const audioRequirementMet = noMusicCheckbox.checked || (uploadedAudio?.audioBuffer && !audioError.textContent && !audioTimeError.textContent);
    const fadeTimeErrorFree = !generalError.textContent.includes("fade time");
    createVideoButton.disabled = !(imagesPresent && durationValid && audioRequirementMet && fadeTimeErrorFree);
  }

  async function loadAndValidateAudioBuffer() {
    if (!uploadedAudio || !uploadedAudio.objectURL || uploadedAudio.audioBuffer) return true;
    displayError(audioError, "🎵 Decoding audio... Please wait!");
    audioStartTimeInput.disabled = true;
    audioFadeTimeInput.disabled = true;

    try {
      if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended") await audioContext.resume();
      const response = await fetch(uploadedAudio.objectURL);
      if (!response.ok) throw new Error(`HTTP error! ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      uploadedAudio.audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      uploadedAudio.duration = uploadedAudio.audioBuffer.duration;
      console.log("Audio decoded, duration:", uploadedAudio.duration);
      audioActualDurationSpan.textContent = uploadedAudio.duration.toFixed(2);

      if (uploadedAudio.duration && uploadedAudio.duration > 0) {
        const maxStartTime = uploadedAudio.duration * 0.99;
        const maxFadeTime = uploadedAudio.duration * 0.50;
        console.log(`Re-initializing audio inputs: Max Start=${maxStartTime.toFixed(3)}, Max Fade=${maxFadeTime.toFixed(3)}`);
        handleInputChange("audioStartTime", "musicminousbtn", "musicplusbtn", 0, maxStartTime);
        handleInputChange("audioFadeTime", "fademinousbtn", "fadeplusbtn", 0, maxFadeTime);
        document.getElementById("audioStartTime").dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById("audioFadeTime").dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        console.log("Audio duration is invalid or zero. Resetting audio input limits.");
        handleInputChange("audioStartTime", "musicminousbtn", "musicplusbtn", 0, 0);
        handleInputChange("audioFadeTime", "fademinousbtn", "fadeplusbtn", 0, 0);
        document.getElementById("audioStartTime").value = 0;
        document.getElementById("audioFadeTime").value = 0;
      }

      displayError(audioError, "");
      validateAudioStartTime();
      validateFadeTime();
      updateAudioOptionsVisibility();
      return true;
    } catch (error) {
      console.error("Error decoding audio:", error);
      displayError(audioError, `🚫 Audio processing failed: ${error.message}`);
      uploadedAudio.audioBuffer = null;
      uploadedAudio.duration = null;
      audioActualDurationSpan.textContent = "--";
      updateAudioOptionsVisibility();
      return false;
    } finally {
      updateCreateButtonState();
    }
  }

  function handleAudioStartTimeChange() {
    clearErrors();
    validateAudioStartTime();
    updateCreateButtonState();
  }

  function validateAudioStartTime() {
    const input = audioStartTimeInput;
    const errorEl = audioTimeError;
    errorEl.textContent = "";
    let parsedValue = parseFloat(input.value || "0");

    if (isNaN(parsedValue) || parsedValue < 0) {
      desiredAudioStartTime = 0;
      input.value = 0;
      errorEl.textContent = "⏱️ Start time must be >= 0!";
      return false;
    }

    desiredAudioStartTime = parsedValue;
    if (uploadedAudio?.duration && desiredAudioStartTime >= uploadedAudio.duration) {
      desiredAudioStartTime = 0;
      input.value = 0;
      errorEl.textContent = `⏱️ Start time exceeds audio duration (${uploadedAudio.duration.toFixed(2)}s). Reset to 0.`;
      return false;
    }

    return true;
  }

  function handleAudioFadeTimeChange() {
    validateFadeTime();
    updateCreateButtonState();
  }

  function validateFadeTime() {
    const input = audioFadeTimeInput;
    let parsedValue = parseFloat(input.value || "0");
    let isValid = true;

    if (isNaN(parsedValue) || parsedValue < 0) {
      audioFadeDuration = 0;
      input.value = 0;
    } else if (parsedValue > 5) {
      audioFadeDuration = 5;
      input.value = 5;
    } else {
      audioFadeDuration = parsedValue;
    }

    if (generalError.textContent.includes("fade time")) clearErrors();
    if (calculatedTotalDuration > 0 && (2 * audioFadeDuration > calculatedTotalDuration)) {
      displayError(generalError, `⏱️ Total fade time (${(2 * audioFadeDuration).toFixed(1)}s) exceeds video duration (${calculatedTotalDuration}s)!`);
      isValid = false;
    }

    return isValid;
  }
});
