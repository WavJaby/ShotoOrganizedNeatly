'use strict';

// For older browser
if (!window.performance) window.performance = {now: Date.now};

(function () {
	// Canvas folder
	const canvasFolder = document.getElementById('canvas');
	const backgroundCanvasElement = document.createElement('canvas');

	const pages = {
		loading: document.getElementById('loading'),
		mainMenu: document.getElementById('mainMenu'),
		levels: document.getElementById('levels'),
		inGame: document.getElementById('inGame'),
	};
	let currentPage = pages.loading;

	// Progress bar
	const progressBar = new Progressbar(document.getElementById('loading_progressBar').firstElementChild);

	// Transition
	const transition = document.getElementById('transition');
	const transitionVideo = document.createElement('video');
	transitionVideo.onended = function () {transition.classList.add('hide');};
	transition.appendChild(transitionVideo);

	// Menu
	const continueBtn = document.getElementById('mainMenu_continueBtn');
	const playButton = document.getElementById('mainMenu_playBtn');
	const optionsButton = document.getElementById('mainMenu_optionsBtn');
	const mainMenu_exitBtn = document.getElementById('mainMenu_exitBtn');
	playButton.onclick = function () {changePage(pages.levels);}
	mainMenu_exitBtn.onclick = function () {window.close();};

	// In game
	const levelName = document.getElementById('inGame_levelName');
	const backBtn = document.getElementById('inGame_backBtn');
	const retryBtn = document.getElementById('inGame_retryBtn');
	const nextLevelBtn = document.getElementById('inGame_nextLevelBtn');


	// Levels
	const levels = [
		[1, 3, [3]],
		[3, 1, [3]],
		[5, 5, [5, 6, 7, 8]],
	];
	// Resources
	const images = {
		gridBGImage: './res/grid_bg.png',
		leftArrowIcon: './res/left_arrow_icon.svg',
		rightArrowIcon: './res/right_arrow_icon.svg',
		retryBtn: './res/retry_btn.svg',
		skipBtn: './res/skip_btn.svg',
		piecesImage: [
			'./res/shoto_1x1.png',
			'./res/shoto_1x1_1.png',
			'./res/shoto_1x1_2.png',
			'./res/shoto_1x3.png',
			'./res/shoto_2x1.png',
			'./res/shoto_2x2.png',
			'./res/shoto_2x3.png',
			'./res/shoto_3x2.png',
			'./res/shoto_3x3.png',
		]
	};
	const audios = {
		meow_normal_5: './res/meow_normal_5.ogg'
	};
	// Game control
	/**@type{GameControl}*/
	const gameControl = new GameControl(onGameCompleted, audios);
	// Load resources and process
	console.time('Resources loaded');
	console.time('Image loaded');
	const imageResourcesLoadState = {ratio: 50, progress: 0};
	const audioResourcesLoadState = {ratio: 29, progress: 0};
	const transitionVideoLoadState = {ratio: 20, progress: 0};
	const fontLoadState = {ratio: 1, progress: 0};
	loadVideo(transitionVideo, './res/shotoTransition.webm', transitionVideoLoadState);
	loadAudioResources(audios, audioResourcesLoadState);
	loadImageResources(images, imageResourcesLoadState);
	// Load font
	progressBar.registerTask(fontLoadState);
	document.fonts.load('1em Just Another Hand').then(function () {progressBar.progressDone(fontLoadState)});
	// On resources loaded
	progressBar.onload = async function () {
		console.timeEnd('Image loaded');

		// Init resources
		gameControl.initResources(images);
		console.log(`Loaded ${images.piecesImage.length} pieces`);

		// Transition video
		transitionVideo.playbackRate = 1.5;

		// In game
		backBtn.appendChild(images.leftArrowIcon);
		backBtn.onclick = function () {
			gameControl.setInGame(false);
			gameControl.hide();
			changePage(pages.levels);
		};
		retryBtn.appendChild(images.retryBtn);
		retryBtn.onclick = function () {
			gameControl.setInGame(false);
			gameControl.initLevel(levels[retryBtn.level]);
			transitionStart(function () {
				nextLevelBtn.classList.remove('completed');
				gameControl.setInGame(true);
			});
		};
		nextLevelBtn.appendChild(images.skipBtn);
		nextLevelBtn.appendChild(images.rightArrowIcon);
		nextLevelBtn.onclick = function () {
			gameControl.setInGame(false);
			const name = 'LEVEL ' + (nextLevelBtn.level + 1);
			gameControl.initLevel(levels[nextLevelBtn.level]);
			nextLevelBtn.level++;
			transitionStart(function () {
				levelName.textContent = name;
				nextLevelBtn.classList.remove('completed');
				gameControl.setInGame(true);
			});
		}

		// Generate levels
		const table = document.createElement('table');
		table.className = 'center';
		pages.levels.appendChild(table);
		const tbody = table.createTBody();
		let levelCount = 0;
		for (let i = 0; i < 5; i++) {
			const tableRow = tbody.insertRow();
			for (let j = 0; j < 5; j++) {
				const tableCell = tableRow.insertCell();
				const level = levelCount++;
				const name = (level + 1).toString();
				tableCell.textContent = name;
				tableCell.onclick = function () {
					levelName.textContent = 'LEVEL ' + name;
					nextLevelBtn.classList.remove('completed');
					retryBtn.level = level;
					nextLevelBtn.level = level + 1;
					gameControl.initLevel(levels[level]);
					transitionStart(function () {
						gameControl.setInGame(true);
						gameControl.show();
						changePage(pages.inGame);
					});
				}
			}
		}

		// Done!
		console.timeEnd('Resources loaded');

		// Start render
		requestAnimationFrame(render);

		changePage(pages.mainMenu);


		// gameControl.initLevel(levels[0]);
		// gameControl.setInGame(true);
		// changePage(pages.inGame);
	};

	function onGameCompleted() {
		nextLevelBtn.classList.add('completed');
	}

	canvasFolder.appendChild(backgroundCanvasElement);
	initBackground();
	canvasFolder.appendChild(gameControl.mainCanvasElement);
	window.addEventListener('resize', windowResize);

	// Functions
	function Progressbar(progressBar) {
		/**@type{{ratio: float, progress: float}[]}*/
		const dataList = [];
		let taskLeft = 0;

		this.onload = null;

		this.registerTask = function (data) {
			data.id = dataList;
			dataList.push(data);
			taskLeft++;
		}

		this.progressDone = function (data) {
			data.progress = 1;
			if (--taskLeft > 0) {
				let progress = 0;
				for (const data of dataList) progress += data.progress * data.ratio;
				progressBar.style.width = progress + '%';
			} else {
				progressBar.style.width = '100%';
				setTimeout(this.onload, 100);
				dataList.length = 0;
			}
		}

		this.progressChange = function (data, newProgress) {
			data.progress = newProgress;
			let progress = 0;
			for (const data of dataList) progress += data.progress * data.ratio;
			progressBar.style.width = progress + '%';
		}
	}

	function transitionStart(ended) {
		transition.classList.remove('hide');
		transitionVideoOffset();
		transitionVideo.currentTime = 0;
		transitionVideo.play().then(function () {
			setTimeout(ended, transitionVideo.duration * 500 * (1 / transitionVideo.playbackRate));
		});
	}

	function render() {
		gameControl.render();

		requestAnimationFrame(render);
	}

	function windowResize() {
		initBackground();
		gameControl.resizeCanvas();
	}

	function transitionVideoOffset() {
		transitionVideo.style.left = (window.innerWidth - transitionVideo.offsetWidth) * 0.5 + 'px';
	}

	function changePage(page) {
		console.log(`Open page: ${page.id}`);
		currentPage.classList.add('hide');
		(currentPage = page).classList.remove('hide');
	}

	function initBackground() {
		// Render background
		const width = backgroundCanvasElement.width = window.innerWidth,
			height = backgroundCanvasElement.height = window.innerHeight;
		const canvas = backgroundCanvasElement.getContext('2d');
		canvas.clearRect(0, 0, width, height);
		canvas.drawImage(backgroundCanvasElement, 0, 0);
		canvas.lineWidth = 3;
		canvas.lineJoin = 'round';
		canvas.strokeStyle = '#732819';

		const margin = 20;
		const changeForwardMin = 15, changeForwardMax = 30;
		const change = 2;
		const p = 0.1;

		let x = margin + Math.random() * change * 2 - change;
		let y = margin + Math.random() * change * 2 - change;

		canvas.beginPath();
		drawX(changeForwardMin, changeForwardMax, margin);
		drawY(changeForwardMin, changeForwardMax, width - margin);
		drawX(-changeForwardMax, -changeForwardMin, height - margin);
		drawY(-changeForwardMax, -changeForwardMin, margin);
		canvas.closePath();
		canvas.stroke();

		function drawX(changeForwardMin, changeForwardMax, orgY) {
			canvas.lineTo(x, y);
			while (true) {
				x += changeForwardMin + Math.random() * (changeForwardMax - changeForwardMin);
				if (x > margin + changeForwardMin && x < width - margin - changeForwardMin)
					y += Math.random() * change * 2 - change;
				y -= (y - orgY) * p;
				if (changeForwardMax > 0 && x > width - margin - changeForwardMax) {
					x = width - margin + Math.random() * change * 2 - change;
					break;
				} else if (changeForwardMax < 0 && x < margin - changeForwardMax) {
					x = margin + Math.random() * change * 2 - change
					break;
				}
				canvas.lineTo(x, y);
			}
		}

		function drawY(changeForwardMin, changeForwardMax, orgX) {
			canvas.lineTo(x, y);
			while (true) {
				y += changeForwardMin + Math.random() * (changeForwardMax - changeForwardMin);
				if (y > margin + changeForwardMin && y < height - margin - changeForwardMin)
					x += Math.random() * change * 2 - change;
				x -= (x - orgX) * p;
				if (changeForwardMax > 0 && y > height - margin - changeForwardMax) {
					y = height - margin + Math.random() * change * 2 - change;
					break;
				} else if (changeForwardMax < 0 && y < margin - changeForwardMax) {
					y = margin + Math.random() * change * 2 - change
					break;
				}
				canvas.lineTo(x, y);
			}
		}
	}

	/*
	 * Utils
	 */
	function loadAudioResources(audioToLoad, progressState) {
		progressBar.registerTask(progressState);
		const entries = Object.entries(audioToLoad);
		let imageLeft = 0;
		for (const imageData of Object.values(audioToLoad)) imageLeft++;

		const loadingState = new Float32Array(imageLeft);
		const share = 1 / imageLeft;

		let id = 0;
		for (/**@type [string, string | Array]*/const imageData of entries) {
			// Load each resource
			loadAudio(audioToLoad, imageData[0], imageData[1], id++);
		}

		function loadAudio(dest, key, src, id) {
			const req = new XMLHttpRequest();
			const audio = new Audio();
			dest[key] = audio;
			req.onprogress = function (e) {
				loadingState[id] = e.loaded / e.total;
				// Update progress
				let nowLoad = 0;
				for (let i = 0; i < loadingState.length; i++)
					nowLoad += loadingState[i];
				progressBar.progressChange(progressState, nowLoad * share);
			};
			req.onload = function () {
				audio.src = URL.createObjectURL(req.response);
				if (--imageLeft === 0)
					progressBar.progressDone(progressState);
			};
			req.open('GET', src);
			req.responseType = 'blob';
			req.send();
		}
	}

	function loadImageResources(imagesToLoad, progressState) {
		progressBar.registerTask(progressState);
		const entries = Object.entries(imagesToLoad);
		let imageLeft = 0;
		for (const imageData of Object.values(imagesToLoad)) imageLeft += ((imageData instanceof Array) ? imageData.length : 1);

		const loadingState = new Float32Array(imageLeft);
		const share = 1 / imageLeft;

		let id = 0;
		for (/**@type [string, string | Array]*/const imageData of entries) {
			// Load each resource
			const resource = imageData[1];
			if (resource instanceof Array) {
				const category = imagesToLoad[imageData[0]];
				for (let i = 0; i < resource.length; i++)
					loadImage(category, i, resource[i], id++);
			} else {
				loadImage(imagesToLoad, imageData[0], imageData[1], id++);
			}
		}

		function loadImage(dest, key, src, id) {
			const req = new XMLHttpRequest();
			const image = new Image();
			dest[key] = image;
			req.onprogress = function (e) {
				loadingState[id] = e.loaded / e.total;
				// Update progress
				let nowLoad = 0;
				for (let i = 0; i < loadingState.length; i++)
					nowLoad += loadingState[i];
				progressBar.progressChange(progressState, nowLoad * share);
			};
			req.onload = function () {
				image.src = URL.createObjectURL(req.response);
				if (--imageLeft === 0)
					progressBar.progressDone(progressState);
			};
			req.open('GET', src);
			req.responseType = 'blob';
			req.send();
		}
	}

	/**
	 * @param {HTMLVideoElement} videoElement
	 * @param {string} src
	 * @param progressState
	 */
	function loadVideo(videoElement, src, progressState) {
		progressBar.registerTask(progressState);
		const req = new XMLHttpRequest();
		req.onload = function () {
			videoElement.src = URL.createObjectURL(req.response);
			videoElement.load();
			progressBar.progressDone(progressState);
		};
		req.onprogress = function (e) {
			progressBar.progressChange(progressState, e.loaded / e.total);
		};
		req.open('GET', src);
		req.responseType = 'blob';
		req.send();
	}
})();