'use strict';
const canvasElement = document.createElement('canvas');
const canvas = canvasElement.getContext('2d');
const tilesSize = 64;
const rotateTime = 1 / 200;
const stickToGridTime = 1 / 200;
const stickThreshold = 33;
const unStickThreshold = 32;

// For older browser
if (!window.performance) window.performance = {now: Date.now};

function Piece(x, y, w, h, id, shape, image) {
	this.originalX = x;
	this.originalY = y;
	this.originalW = w;
	this.originalH = h;
	this.id = id;
	this.image = image;
	this.shape = shape;

	// can be changed
	this.x = x;
	this.y = y;
	this.w = w;
	this.h = h;
	this.rotateIndexOnGrid = 0;
	this.rotateIndex = 0;
	this.isStickToGrid = false;
	this.gridOffset = -1;

	/*
		Animation used
	 */
	// rotate
	this.rotateAngle = 0;
	this.rotateCount = 0;
	this.rotateStartTime = 0;
	this.rotateFromAngle = 0;
	this.rotateToAngle = 0;

	// move
	this.moveOffsetX = 0;
	this.moveOffsetY = 0;
	this.isStickToGridTemporary = false;
	this.isMoving = false;
	this.isDetaching = false;
	this.startMoveX = 0;
	this.startMoveY = 0;
	this.stickToGridStartTime = 0;
	this.stickToXFrom = 0;
	this.stickToYFrom = 0;
	this.stickToX = -1;
	this.stickToY = -1;
}

// Main
(function () {
	const gridCanvasElement = document.createElement('canvas');
	const gridBGCanvasElement = document.createElement('canvas');
	const backgroundCanvasElement = document.createElement('canvas');
	let needRefresh = true;

	const tilesGap = 3;
	const tilesCountX = 3, tilesCountY = 3;
	const gridPoints = [];
	let gridTileFilled;
	let gridTilesLeft;

	/**@type Piece*/
	let selectedPiece = null;
	let stickToMouse = false;
	let isMouseLeftDown = false;
	let mouseX = 0, mouseY = 0;
	let lastHoldMouseX = 0, lastHoldMouseY = 0;
	window.addEventListener('mousemove', function (e) {
		mouseX = e.pageX;
		mouseY = e.pageY;
		if (isMouseLeftDown) {
			lastHoldMouseX = mouseX;
			lastHoldMouseY = mouseY;
		}

		if (stickToMouse) {
			const moveX = mouseX - selectedPiece.moveOffsetX, moveY = mouseY - selectedPiece.moveOffsetY;
			// Stick on grid
			if (selectedPiece.isStickToGridTemporary) {
				if (!selectedPiece.isDetaching) {
					// Check if piece need detach
					if (Math.abs(moveX - selectedPiece.stickToX) > unStickThreshold ||
						Math.abs(moveY - selectedPiece.stickToY) > unStickThreshold) {
						if (!findPointToStick(moveX, moveY, stickThreshold, selectedPiece)) {
							// Stop stick to grid, start stick with mouse
							// console.log('unstick');
							selectedPiece.stickToXFrom = selectedPiece.x;
							selectedPiece.stickToYFrom = selectedPiece.y;
							selectedPiece.stickToGridStartTime = performance.now();
							selectedPiece.isDetaching = true;
							selectedPiece.isStickToGridTemporary = false;
						} else {
							// Change to stick other tile
							// console.log('stick change');
						}
					}
					// Is stick to tile, and making small move towards to mouse
					else {

					}
				}
			}
			// Piece is moving freely
			else {
				if (!selectedPiece.isMoving) {
					// No point found, just stick with mouse
					if (!findPointToStick(moveX, moveY, stickThreshold, selectedPiece)) {
						selectedPiece.x = moveX;
						selectedPiece.y = moveY;
					} else {
						// console.log('stick');
						selectedPiece.isDetaching = false;
						selectedPiece.isStickToGridTemporary = true;
					}
				}
			}

			needRefresh = true;
		}
	});

	window.addEventListener('mousedown', function (e) {
		mouseX = e.pageX;
		mouseY = e.pageY;
		if (e.button === 0)
			isMouseLeftDown = true;

		// Grab piece
		let i = 0;
		for (const piece of pieces) {
			if (mouseX > piece.x && mouseX < piece.x + piece.w &&
				mouseY > piece.y && mouseY < piece.y + piece.h) {
				selectedPiece = piece;
				break;
			}
			i++;
		}
		if (i !== pieces.length) {
			selectedPiece.moveOffsetX = mouseX - selectedPiece.x;
			selectedPiece.moveOffsetY = mouseY - selectedPiece.y;
			if (e.button === 0) {
				selectedPiece.startMoveX = selectedPiece.x;
				selectedPiece.startMoveY = selectedPiece.y;
				stickToMouse = true;
			}

			// To top layer
			pieces.splice(i, 1);
			pieces.splice(0, 0, selectedPiece);
		}
	});

	window.addEventListener('mouseup', function (e) {
		// Left button up
		if (e.button === 0) {
			isMouseLeftDown = false;
			pieceRelease();
		}
	});

	window.addEventListener('contextmenu', (e) => {
		e.preventDefault();

		// Click ones
		if (selectedPiece && (!selectedPiece.isStickToGrid || stickToMouse) && selectedPiece.rotateCount < 2 && selectedPiece.rotateCount++ === 0) {
			pieceRotate(selectedPiece);
		}
	});

	const piecesImage = [
		'./res/shoto_1x1.png',
		'./res/shoto_1x1_1.png',
		'./res/shoto_1x1_2.png',
		'./res/shoto_2x1.png',
		'./res/shoto_2x2.png',
		'./res/shoto_2x3.png',
		'./res/shoto_3x1.png',
		'./res/shoto_3x2.png',
		'./res/shoto_3x3.png',
	];
	const piecesShape = [
		[1, 1, [0]],
		[1, 1, [0]],
		[1, 1, [0]],
		[2, 1, [0, 1]],
		[2, 2, [0, 1, 2, 3]],
		[2, 3, [0, 1, 2, 3, 4, 5]],
		[3, 1, [0, 1, 2]],
		[3, 2, [0, 1, 2, 3, 5]],
		[3, 3, [0, 1, 2, 3, 4, 5, 6, 7, 8]],
	];
	const sceneImage = {gridBGImage: './res/grid_bg.png'};
	let imageLoadTaskCount = 2;
	loadImages(sceneImage, function (progress) {
		console.log(progress);
	}, onImagesLoad);
	loadImages(piecesImage, function (progress) {
		console.log(progress);
	}, onImagesLoad);
	/**@type Piece[]*/
	const pieces = [];

	function onImagesLoad() {
		if (--imageLoadTaskCount !== 0) return;
		console.log('Image resources loaded');
		initScene();
	}

	resizeCanvas();
	requestAnimationFrame(renderScene);
	window.addEventListener('resize', resizeCanvas);
	document.body.appendChild(canvasElement);

	// Functions
	function initScene() {
		initGridBackground(sceneImage.gridBGImage);
		initGrid();
		initPiece();
		needRefresh = true;
	}

	function renderScene() {
		// Calculate
		calculatePiecesMove();

		// Rerender
		if (needRefresh) {
			needRefresh = false;

			canvas.clearRect(0, 0, canvasElement.width, canvasElement.height);
			canvas.drawImage(backgroundCanvasElement, 0, 0);
			renderGridBackground();
			renderGrid();
			renderPieces();

			canvas.fillStyle = '#F00';
			canvas.fillRect(0, 0, 10, 10);
		} else
			canvas.clearRect(0, 0, 10, 10);

		requestAnimationFrame(renderScene);
	}

	function resizeCanvas() {
		backgroundCanvasElement.width = canvasElement.width = window.innerWidth;
		backgroundCanvasElement.height = canvasElement.height = window.innerHeight;
		initBackground();
		calculateGridPoints();
		needRefresh = true;
	}

	function pieceRelease() {
		if (selectedPiece) {
			stickToMouse = false;

			const orgGridOffset = selectedPiece.gridOffset;

			// Remove old piece from grid
			if (selectedPiece.isStickToGrid && orgGridOffset !== -1) {
				for (let i = 0; i < selectedPiece.shape[2].length; i++) {
					const [pieceOffsetX, pieceOffsetY] = pieceCastRotation(selectedPiece, selectedPiece.rotateIndexOnGrid, i);
					const offset = orgGridOffset + pieceOffsetY * tilesCountX + pieceOffsetX;
					gridTileFilled[offset] = 0;
				}
			}

			// Check to stick
			const x = selectedPiece.isDetaching ? lastHoldMouseX - selectedPiece.moveOffsetX :
				selectedPiece.isMoving ? selectedPiece.stickToXFrom + selectedPiece.stickToX
					: selectedPiece.x;
			const y = selectedPiece.isDetaching ? lastHoldMouseY - selectedPiece.moveOffsetY :
				selectedPiece.isMoving ? selectedPiece.stickToYFrom + selectedPiece.stickToY
					: selectedPiece.y;
			if (findPointToStick(x, y, stickThreshold, selectedPiece, true)) {
				let invalidPosition = false;
				if (selectedPiece.gridOffset !== -1) {
					// Check position valid
					let newPositionValid = true;
					for (let i = 0; i < selectedPiece.shape[2].length; i++) {
						const [pieceOffsetX, pieceOffsetY] = pieceCastRotation(selectedPiece, selectedPiece.rotateIndex, i);

						const offset = selectedPiece.gridOffset + pieceOffsetY * tilesCountX + pieceOffsetX;
						if (selectedPiece.gridOffset % tilesCountX + pieceOffsetX >= tilesCountX ||
							(selectedPiece.gridOffset / tilesCountY | 0) + pieceOffsetY >= tilesCountY ||
							gridTileFilled[offset] !== 0
						) {
							newPositionValid = false;
							break;
						}
					}

					// New point valid
					if (newPositionValid) {
						// Add to grid
						selectedPiece.isStickToGrid = true;
						selectedPiece.rotateIndexOnGrid = selectedPiece.rotateIndex;
						if (orgGridOffset === -1)
							gridTilesLeft -= selectedPiece.shape[2].length;
						for (let i = 0; i < selectedPiece.shape[2].length; i++) {
							const [pieceOffsetX, pieceOffsetY] = pieceCastRotation(selectedPiece, selectedPiece.rotateIndex, i);
							const offset = selectedPiece.gridOffset + pieceOffsetY * tilesCountX + pieceOffsetX;
							gridTileFilled[offset] = 1;
						}
						// console.log('can stick');
					} else
						invalidPosition = true;
				} else
					invalidPosition = true;

				// Stick back to original place
				if (invalidPosition) {
					selectedPiece.gridOffset = orgGridOffset;

					// Rotate back
					if (selectedPiece.rotateIndexOnGrid !== selectedPiece.rotateIndex) {
						// Go back to default position
						selectedPiece.rotateCount = 1;
						pieceRotate(selectedPiece, selectedPiece.rotateIndexOnGrid);
					}
					// Move back
					pieceStick(selectedPiece.startMoveX, selectedPiece.startMoveY, selectedPiece);

					if (orgGridOffset !== -1) {
						// Write piece to original place
						for (let i = 0; i < selectedPiece.shape[2].length; i++) {
							const [pieceOffsetX, pieceOffsetY] = pieceCastRotation(selectedPiece, selectedPiece.rotateIndexOnGrid, i);
							gridTileFilled[selectedPiece.gridOffset + pieceOffsetY * tilesCountX + pieceOffsetX] = 1;
						}
					}
				}
			} else {
				selectedPiece.isStickToGrid = false;
				if (orgGridOffset !== -1)
					gridTilesLeft += selectedPiece.shape[2].length;
			}

			let result = '';
			for (let i = 0; i < tilesCountY; i++) {
				for (let j = 0; j < tilesCountX; j++)
					result += gridTileFilled[i * tilesCountX + j] + ' ';
				result += '\n';
			}
			console.log(result);
			console.log(gridTilesLeft);
			console.log(selectedPiece);

			selectedPiece = null;
		}
	}

	/**
	 * @param {Piece} piece
	 * @param {int} rotation
	 * @param {int} index
	 */
	function pieceCastRotation(piece, rotation, index) {
		const pieceOffsetX = selectedPiece.shape[2][index] % piece.shape[0];
		const pieceOffsetY = selectedPiece.shape[2][index] / piece.shape[0] | 0;

		if (rotation === 0)
			// 0deg
			return [pieceOffsetX, pieceOffsetY];
		if (rotation === 1)
			// 90deg
			return [(selectedPiece.shape[1] - pieceOffsetY - 1), pieceOffsetX];
		if (rotation === 2)
			// 180deg
			return [(selectedPiece.shape[0] - pieceOffsetX - 1), (selectedPiece.shape[1] - pieceOffsetY - 1)];
		if (rotation === 3)
			// 270deg
			return [pieceOffsetY, (selectedPiece.shape[0] - pieceOffsetX - 1)];
	}

	/**
	 * @param {Piece} piece
	 * @param {number} [rotateIndex]
	 */
	function pieceRotate(piece, rotateIndex) {
		// console.log('piece rotate');

		const step = rotateIndex !== undefined ? rotateIndex - piece.rotateIndex : 1;
		piece.rotateFromAngle = piece.rotateIndex * Math.PI * 0.5;
		piece.rotateIndex = rotateIndex !== undefined ? rotateIndex : ((piece.rotateIndex + 1) % 4);

		// Change position, size
		const orgW = piece.w, orgH = piece.h;
		if (step % 2) {
			piece.w = orgH;
			piece.h = orgW;
		}

		// Rotate settings
		piece.rotateToAngle = step * Math.PI * 0.5;
		piece.rotateStartTime = window.performance.now();

		// Change offset
		piece.x += (orgW - piece.w) * 0.5;
		piece.y += (orgH - piece.h) * 0.5;
		if (stickToMouse) {
			piece.moveOffsetX -= (orgW - piece.w) * 0.5;
			piece.moveOffsetY -= (orgH - piece.h) * 0.5;
		}
	}

	/**
	 * @param {Piece} piece
	 * @param {number} x
	 * @param {number} y
	 */
	function pieceStick(x, y, piece) {
		if (!piece.isMoving) {
			// console.log(`stick from ${piece.x}, ${piece.y} to ${x}, ${y}`);
			piece.stickToXFrom = piece.x;
			piece.stickToYFrom = piece.y;
			piece.stickToX = x - piece.stickToXFrom;
			piece.stickToY = y - piece.stickToYFrom;
			piece.stickToGridStartTime = performance.now();
			piece.isMoving = true;
		}
	}

	function findPointToStick(positionX, positionY, threshold, piece, setOffset) {
		let i = 0;
		for (const gridPoint of gridPoints) {
			let addX = false, addY = false;
			if (
				Math.abs(positionX - gridPoint[0]) < threshold && Math.abs(positionY - gridPoint[1]) < threshold ||
				(addX = (Math.abs(positionX + piece.w - tilesSize - gridPoint[0]) < threshold)) && Math.abs(positionY - gridPoint[1]) < threshold ||
				Math.abs(positionX - gridPoint[0]) < threshold && (addY = (Math.abs(positionY + piece.h - tilesSize - gridPoint[1]) < threshold)) ||
				(addX = (Math.abs(positionX + piece.w - tilesSize - gridPoint[0]) < threshold)) && (addY = (Math.abs(positionY + piece.h - tilesSize - gridPoint[1]) < threshold))
			) {
				if (setOffset)
					piece.gridOffset = addX || addY ? -1 : i;

				// Same point skip
				const toX = addX ? gridPoint[0] - piece.w + tilesSize : gridPoint[0],
					toY = addY ? gridPoint[1] - piece.h + tilesSize : gridPoint[1];
				if (toX === piece.x && toY === piece.y) {
					// console.log('skip');
					return true;
				}

				// Stick settings
				pieceStick(toX, toY, piece);
				return true;
			}
			i++;
		}
		if (setOffset)
			piece.gridOffset = -1;
		return false;
	}

	function initGridBackground(gridBGImage) {
		console.time('Init Grid BG');
		const backgroundColor = 0xF4E7DF;
		gridBGCanvasElement.width = gridBGImage.width;
		gridBGCanvasElement.height = gridBGImage.height;
		const gridBGCanvas = gridBGCanvasElement.getContext('2d');
		gridBGCanvas.drawImage(gridBGImage, 0, 0, gridBGCanvasElement.width, gridBGCanvasElement.height);
		const imageData = gridBGCanvas.getImageData(0, 0, gridBGCanvasElement.width, gridBGCanvasElement.height);
		const data = imageData.data;
		for (let i = 0; i < data.length; i += 4) {
			if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] !== 0) {
				data[i] = (backgroundColor >> 16) & 0xFF;
				data[i + 1] = (backgroundColor >> 8) & 0xFF;
				data[i + 2] = backgroundColor & 0xFF;
			}
		}
		gridBGCanvas.putImageData(imageData, 0, 0);
		console.timeEnd('Init Grid BG');
	}

	function renderGridBackground() {
		const size = Math.min(canvasElement.width, canvasElement.height) - 300;
		canvas.drawImage(gridBGCanvasElement,
			(canvasElement.width - size) * 0.5, (canvasElement.height - size) * 0.5,
			size, size);
	}

	function initGrid() {
		const totalWidth = tilesCountX * tilesSize;
		const totalHeight = tilesCountY * tilesSize;
		gridCanvasElement.width = totalWidth;
		gridCanvasElement.height = totalHeight;
		gridTileFilled = new Uint8Array(tilesCountX * tilesCountY);
		gridTilesLeft = tilesCountX * tilesCountY;
		const canvas = gridCanvasElement.getContext('2d');
		const canvasOffsetX = (canvasElement.width - gridCanvasElement.width) * 0.5,
			canvasOffsetY = (canvasElement.height - gridCanvasElement.height) * 0.5;
		gridPoints.length = 0;
		canvas.fillStyle = '#C6B0A3';
		for (let i = 0; i < 3; i++) {
			for (let j = 0; j < 3; j++) {
				const x = tilesSize * j, y = tilesSize * i;
				gridPoints.push([x + canvasOffsetX, y + canvasOffsetY]);
				// Draw tiles
				canvas.fillRect(x + tilesGap, y + tilesGap, tilesSize - tilesGap * 2, tilesSize - tilesGap * 2);
			}
		}
	}

	function calculateGridPoints() {
		const canvasOffsetX = (canvasElement.width - gridCanvasElement.width) * 0.5,
			canvasOffsetY = (canvasElement.height - gridCanvasElement.height) * 0.5;
		gridPoints.length = 0;
		for (let i = 0; i < 3; i++) {
			for (let j = 0; j < 3; j++) {
				const x = tilesSize * j, y = tilesSize * i;
				gridPoints.push([x + canvasOffsetX, y + canvasOffsetY]);
			}
		}
	}

	function renderGrid() {
		canvas.drawImage(gridCanvasElement,
			(canvasElement.width - gridCanvasElement.width) * 0.5,
			(canvasElement.height - gridCanvasElement.height) * 0.5);
	}

	function initPiece() {
		if (imageLoadTaskCount !== 0) return;

		const gap = 10;
		const margin = 50;
		let x = margin, y = margin;
		let lineMaxH = 0;
		// create piece
		for (let i = 0; i < piecesImage.length; i++) {
			const w = piecesShape[i][0] * tilesSize, h = piecesShape[i][1] * tilesSize;
			// new line
			if (x + w > canvasElement.width - margin) {
				x = margin;
				y += lineMaxH + gap;
				lineMaxH = 0;
			}
			// create piece
			pieces[i] = new Piece(x, y, w, h, i, piecesShape[i], piecesImage[i]);

			if (h > lineMaxH)
				lineMaxH = h;
			x += w + gap;
		}
	}

	function calculatePiecesMove() {
		for (/**@type Piece*/const piece of pieces) {
			// Rotate
			if (piece.rotateCount !== 0) {
				const percent = (window.performance.now() - piece.rotateStartTime) * rotateTime;
				if (percent >= 1) {
					piece.rotateAngle = piece.rotateFromAngle + piece.rotateToAngle;
					piece.rotateCount--;
					// Keep rotate
					if (piece.rotateCount !== 0)
						pieceRotate(selectedPiece);
				} else
					piece.rotateAngle = piece.rotateFromAngle + piece.rotateToAngle * easeInOut(percent);
				needRefresh = true;
			}

			// Stick to grid
			if (piece.isMoving) {
				const percent = (window.performance.now() - piece.stickToGridStartTime) * stickToGridTime;
				if (percent >= 1) {
					piece.x = piece.stickToXFrom + piece.stickToX;
					piece.y = piece.stickToYFrom + piece.stickToY;
					piece.isMoving = false;
				} else {
					const ease = easeInOut(percent);
					piece.x = piece.stickToXFrom + piece.stickToX * ease;
					piece.y = piece.stickToYFrom + piece.stickToY * ease;
				}
				needRefresh = true;
			}

			// Unstick from grid
			if (piece.isDetaching) {
				const percent = (window.performance.now() - piece.stickToGridStartTime) * stickToGridTime;
				const moveX = lastHoldMouseX - piece.moveOffsetX, moveY = lastHoldMouseY - piece.moveOffsetY;
				if (percent >= 1) {
					piece.x = moveX;
					piece.y = moveY;
					piece.isDetaching = false;
				} else {
					const ease = easeInOut(percent);
					piece.x = piece.stickToXFrom * (1 - ease) + moveX * ease;
					piece.y = piece.stickToYFrom * (1 - ease) + moveY * ease;
				}
				needRefresh = true;
			}
		}
	}

	function renderPieces() {
		for (let i = pieces.length - 1; i > -1; i--) {
			const piece = pieces[i];
			canvas.strokeStyle = 'red';
			canvas.strokeRect(piece.x, piece.y, piece.w, piece.h);

			drawImage(piece.image, piece.rotateAngle,
				piece.x + (piece.w - piece.originalW) * 0.5, piece.y + (piece.h - piece.originalH) * 0.5,
				piece.originalW, piece.originalH);
		}
	}

	function initBackground() {
		const width = backgroundCanvasElement.width, height = backgroundCanvasElement.height;
		const canvas = backgroundCanvasElement.getContext('2d');
		canvas.clearRect(0, 0, width, height);
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

	function easeInOut(t) {
		return t * t * (3 - 2 * t);
	}

	function drawImage(image, angel, x, y, w, h) {
		if (angel !== 0) {
			const wr = w * 0.5, hr = h * 0.5;
			canvas.translate(x + wr, y + hr);
			canvas.rotate(angel);
			canvas.drawImage(image, -wr, -hr, w, h);
			canvas.rotate(-angel);
			canvas.translate(-x - wr, -y - hr);
		} else
			canvas.drawImage(image, x, y, w, h);
	}

	function loadImages(imagesToLoad, progress, onload) {
		if (imagesToLoad instanceof Array) {
			let imageLeft = imagesToLoad.length;
			const total = 1 / imageLeft;
			for (let i = 0; i < imagesToLoad.length; i++) {
				const image = new Image();
				image.src = imagesToLoad[i];
				image.onload = function () {
					imagesToLoad[i] = image;
					if (--imageLeft === 0)
						onload();
					else
						progress(1 - imageLeft * total);
				};
			}
		} else {
			const entries = Object.entries(imagesToLoad);
			let imageLeft = entries.length;
			const total = 1 / imageLeft;
			for (const imageData of entries) {
				const image = new Image();
				image.src = imageData[1];
				image.onload = function () {
					imagesToLoad[imageData[0]] = image;
					if (--imageLeft === 0)
						onload();
					else
						progress(1 - imageLeft * total);
				};
			}
		}
	}
})();