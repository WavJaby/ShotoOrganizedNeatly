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
		inGame: document.getElementById('inGame'),
	};
	let currentPage = pages.loading;

	// Progress bar
	const progressBar = document.getElementById('loading_progressBar').firstChild;

	// Menu
	const playButton = document.getElementById('mainMenu_playBtn');
	const optionsButton = document.getElementById('mainMenu_optionsBtn');
	playButton.onclick = function () {
		changePage(pages.inGame);

		// initLevel(1, 3, [3]);
		gameControl.initLevel(5, 5, [5, 6, 7, 8]);
		gameControl.setInGame(true);
	}

	// Game control
	/**@type{GameControl}*/
	const gameControl = new GameControl();
	canvasFolder.appendChild(backgroundCanvasElement);
	canvasFolder.appendChild(gameControl.mainCanvasElement);
	initBackground();
	requestAnimationFrame(render);

	// Init resources
	const resources = {
		gridBGImage: './res/grid_bg.png',
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
	// Load resources and process
	console.time('Resources loaded');
	console.time('Image loaded');
	loadResources(resources, function (progress) {
		progressBar.style.width = (progress * 100) + '%';
	}, function () {
		console.timeEnd('Image loaded');

		// Load font
		document.fonts.load('1em Just Another Hand').then(function () {
			changePage(pages.mainMenu);
		});

		// Init resources
		gameControl.initResources(resources);
		console.log(`Loaded ${resources.piecesImage.length} pieces`);

		// Done!
		console.timeEnd('Resources loaded');
		progressBar.style.width = '100%';
	});

	window.addEventListener('resize', windowResize);


	// Functions
	function render() {
		gameControl.render();

		requestAnimationFrame(render);
	}

	function windowResize() {
		initBackground();
		gameControl.resizeCanvas();
	}

	function changePage(page) {
		console.log(`Open page: ${page.id}`);
		currentPage.className = 'hide';
		(currentPage = page).className = '';
	}

	function initBackground() {
		// Render background
		const width = backgroundCanvasElement.width = window.innerWidth,
			height = backgroundCanvasElement.height = window.innerHeight;
		const canvas = backgroundCanvasElement.getContext('2d');
		canvas.clearRect(0, 0, width, height);
		canvas.drawImage(backgroundCanvasElement, 0, 0);
		canvas.lineWidth = 7;
		canvas.lineJoin = 'round';
		canvas.strokeStyle = '#9A664E';

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
	function loadResources(imagesToLoad, progress, onload) {
		const entries = Object.entries(imagesToLoad);
		let imageLeft = 0;
		for (const imageData of Object.values(imagesToLoad))
			imageLeft += ((imageData instanceof Array) ? imageData.length : 1);
		const total = 1 / imageLeft;

		for (/**@type [string, string | Array]*/const imageData of entries) {
			// Load each resource
			const resource = imageData[1];
			if (resource instanceof Array) {
				const category = imagesToLoad[imageData[0]];
				for (let i = 0; i < resource.length; i++)
					loadImage(category, i, resource[i]);
			} else {
				loadImage(imagesToLoad, imageData[0], imageData[1]);
			}
		}

		function loadImage(dest, key, src) {
			const image = new Image();
			image.src = src;
			image.onload = function () {
				dest[key] = image;
				if (--imageLeft === 0) onload();
				else progress(1 - imageLeft * total);
			};
		}
	}
})();