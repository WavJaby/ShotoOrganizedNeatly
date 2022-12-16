'use strict';

function Piece(x, y, w, h, id, shape, image) {
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

function GameControl() {
	const tilesGap = 3;
	const tilesSize = 64; // With gap
	const rotateTime = 1 / 200;
	const stickToGridTime = 1 / 200;
	const stickThreshold = 33;
	const unStickThreshold = 32;
	const piecesShape = [
		[1, 1, [0]],
		[1, 1, [0]],
		[1, 1, [0]],
		[1, 3, [0, 1, 2]],
		[2, 1, [0, 1]],
		[2, 2, [0, 1, 2, 3]],
		[2, 3, [0, 1, 2, 3, 4, 5]],
		[3, 2, [0, 1, 2, 3, 4, 5]],
		[3, 3, [0, 1, 2, 3, 4, 5, 6, 7, 8]],
	];
	/**@type Piece[]*/
	const pieces = [];

	const mainCanvasElement = this.mainCanvasElement = document.createElement('canvas');
	const mainCanvas = mainCanvasElement.getContext('2d');
	let mainCanvasRefresh = false;
	let inGame = false;

	// Scene
	const grid = {
		canvasElement: document.createElement('canvas'),
		bgCanvasElement: document.createElement('canvas'),
		bgCanvasSize: 0,
		tilesCountX: 0,
		tilesCountY: 0,
		anchorPoints: null,
		/**@type{Piece[]}*/
		piecesForLevel: [],
	}
	let gridTileFilled;
	let gridTilesLeft;
	/**@type{Piece}*/
	let selectedPiece = null;
	let stickToMouse = false;
	let isMouseLeftDown = false;
	let touchScreen = false;
	let mouseX = 0, mouseY = 0;
	let lastHoldMouseX = 0, lastHoldMouseY = 0;
	window.addEventListener('mousemove', movePiece);
	window.addEventListener('touchmove', movePiece);

	window.addEventListener('mousedown', selectPiece);
	window.addEventListener('touchstart', selectPiece);

	window.addEventListener('mouseup', unselectPiece);
	window.addEventListener('touchend', unselectPiece);
	window.addEventListener('touchcancel', unselectPiece);

	window.addEventListener('contextmenu', function (e) {
		e.preventDefault();

		// Click ones
		if (selectedPiece && (!selectedPiece.isStickToGrid || stickToMouse) && selectedPiece.rotateCount < 2 && selectedPiece.rotateCount++ === 0) {
			pieceRotate(selectedPiece);
		}
	});


	// Functions
	this.initResources = function (resources) {
		processPiece(pieces, resources);
		try {
			processGridBackgroundImage(resources.gridBGImage);
		} catch (e) {
			console.error(e);
		}
	}

	this.resizeCanvas = function () {
		if (!inGame) return;
		// console.log('Resize game canvas');

		resizeMainCanvas();

		// Recalculate anchor points
		calculateAnchorPoints();

		mainCanvasRefresh = true;
	}

	/**
	 * @param {int} tilesCountX
	 * @param {int} tilesCountY
	 * @param {int[]} pieceIDs
	 */
	this.initLevel = function (tilesCountX, tilesCountY, pieceIDs) {
		resizeMainCanvas();
		grid.tilesCountX = tilesCountX;
		grid.tilesCountY = tilesCountY;
		const totalWidth = grid.canvasElement.width = tilesCountX * tilesSize;
		const totalHeight = grid.canvasElement.height = tilesCountY * tilesSize;
		gridTilesLeft = tilesCountX * tilesCountY;
		gridTileFilled = new Uint8Array(gridTilesLeft);

		const canvas = grid.canvasElement.getContext('2d');
		const canvasOffsetX = (mainCanvasElement.width - totalWidth) * 0.5,
			canvasOffsetY = (mainCanvasElement.height - totalHeight) * 0.5;
		grid.bgCanvasSize = (Math.max(tilesCountX, tilesCountY) + 3) * tilesSize;
		const bgCanvasOffsetX = (mainCanvasElement.width - grid.bgCanvasSize) * 0.5;

		canvas.fillStyle = '#C6B0A3';

		// Draw tiles and set anchor
		grid.anchorPoints = new Uint32Array(gridTilesLeft * 2);
		let k = 0;
		for (let i = 0; i < tilesCountY; i++) {
			for (let j = 0; j < tilesCountX; j++) {
				const x = tilesSize * j, y = tilesSize * i;
				grid.anchorPoints[k++] = x + canvasOffsetX;
				grid.anchorPoints[k++] = y + canvasOffsetY;
				// Draw tiles
				canvas.fillRect(x + tilesGap, y + tilesGap, tilesSize - tilesGap * 2, tilesSize - tilesGap * 2);
			}
		}

		// Add pieces for level
		grid.piecesForLevel.length = pieceIDs.length;
		const margin = 20;
		let x = margin, ly = margin, ry = margin;
		let rawPieceStart = 0;
		let leftLineMaxHeight = 0, rightLineMaxHeight = 0;
		/** @type {Piece[]}*/
		const leftLinePieces = [], rightLinePieces = [];
		let leftLine = true;
		// Place pieces
		for (let i = 0; i < pieceIDs.length; i++) {
			const piece = grid.piecesForLevel[i] = pieces[pieceIDs[i]];
			// const width = Math.max(piece.w, piece.h) + margin;
			const width = piece.w + margin;

			if (x + width > mainCanvasElement.width - margin) {
				// Place Y
				for (let j = rawPieceStart; j < i; j++) {
					const piece = grid.piecesForLevel[j];
					piece.y += (rightLineMaxHeight - piece.h) * 0.5;
					piece.x += ((mainCanvasElement.width - margin) - x) * 0.5;
				}
				x = margin;
				leftLine = true;
				rawPieceStart = i;
				// New line
				ly += leftLineMaxHeight + margin;
				ry += rightLineMaxHeight + margin;
				rightLineMaxHeight = 0;
				leftLineMaxHeight = 0;
			} else if (leftLine && x + width > bgCanvasOffsetX) {
				// Place Y
				for (let j = rawPieceStart; j < i; j++) {
					const piece = grid.piecesForLevel[j];
					piece.y += (leftLineMaxHeight - piece.h) * 0.5;
					piece.x += (bgCanvasOffsetX - x) * 0.5;
				}
				x = bgCanvasOffsetX + grid.bgCanvasSize;
				leftLine = false;
				rawPieceStart = i;
			}

			// Update line height
			if (leftLine) {
				if (piece.h > leftLineMaxHeight) leftLineMaxHeight = piece.h;
			} else {
				if (piece.h > rightLineMaxHeight) rightLineMaxHeight = piece.h;
			}

			// piece.x = piece.h > piece.w ? x + (piece.h - piece.w) * 0.5 : x;
			piece.x = x;
			piece.y = leftLine ? ly : ry;
			(leftLine ? leftLinePieces : rightLinePieces).push(piece);

			x += width;

			// Last piece
			if (i + 1 === pieceIDs.length) {
				ly += leftLineMaxHeight + margin;
				ry += rightLineMaxHeight + margin;
			}
		}

		for (const leftLinePiece of leftLinePieces)
			leftLinePiece.y += (mainCanvasElement.height - ly) * 0.5;

		for (const rightLinePiece of rightLinePieces)
			rightLinePiece.y += (mainCanvasElement.height - ry) * 0.5;

		// Refresh
		mainCanvasRefresh = true;
	}

	this.render = function () {
		if (!inGame) return;

		// Calculate
		calculatePiecesMove();

		// Rerender
		if (mainCanvasRefresh) {
			mainCanvasRefresh = false;

			// Clear canvas
			mainCanvas.clearRect(0, 0, mainCanvasElement.width, mainCanvasElement.height);

			renderGrid();
			renderPieces();

			mainCanvas.fillStyle = '#F00';
			mainCanvas.fillRect(0, 0, 10, 10);
		} else
			mainCanvas.clearRect(0, 0, 10, 10);
	}

	this.setInGame = function (boolean) {
		inGame = boolean;
	}

	/*
	 * User interact functions
	 */
	function selectPiece(e) {
		if (!inGame) return;

		// Touch screen
		if (e instanceof TouchEvent) {
			mouseX = e.touches[0].pageX;
			mouseY = e.touches[0].pageY;
			touchScreen = true;
			isMouseLeftDown = true;
		}
		// Mouse click
		else if (!touchScreen) {
			mouseX = e.pageX;
			mouseY = e.pageY;
			if (e.button === 0)
				isMouseLeftDown = true;
		}

		// Find and grab piece
		let i = 0;
		for (const piece of grid.piecesForLevel) {
			if (mouseX > piece.x && mouseX < piece.x + piece.w &&
				mouseY > piece.y && mouseY < piece.y + piece.h) {
				selectedPiece = piece;
				break;
			}
			i++;
		}
		if (i !== grid.piecesForLevel.length) {
			selectedPiece.moveOffsetX = mouseX - selectedPiece.x;
			selectedPiece.moveOffsetY = mouseY - selectedPiece.y;
			if (isMouseLeftDown) {
				selectedPiece.startMoveX = selectedPiece.x;
				selectedPiece.startMoveY = selectedPiece.y;
				stickToMouse = true;
			}

			// To top layer
			grid.piecesForLevel.splice(i, 1);
			grid.piecesForLevel.splice(0, 0, selectedPiece);
		}
	}

	function movePiece(e) {
		if (!inGame) return;

		if (e instanceof TouchEvent) {
			mouseX = e.touches[0].pageX;
			mouseY = e.touches[0].pageY;
		} else {
			mouseX = e.pageX;
			mouseY = e.pageY;
		}
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

			mainCanvasRefresh = true;
		}
	}

	function unselectPiece(e) {
		if (!inGame) return;

		// Left button up
		if (e instanceof MouseEvent && e.button === 0 || e instanceof TouchEvent) {
			isMouseLeftDown = false;
			// Cancel double fire when release touchscreen
			if (e instanceof MouseEvent && e.button === 0 && touchScreen)
				touchScreen = false;
			else
				pieceRelease();
		}
	}

	function pieceRelease() {
		if (selectedPiece) {
			stickToMouse = false;

			const orgGridOffset = selectedPiece.gridOffset;

			// Remove old piece from grid
			if (selectedPiece.isStickToGrid && orgGridOffset !== -1) {
				for (let i = 0; i < selectedPiece.shape[2].length; i++) {
					const [pieceOffsetX, pieceOffsetY] = pieceCastRotation(selectedPiece, selectedPiece.rotateIndexOnGrid, i);
					const offset = orgGridOffset + pieceOffsetY * grid.tilesCountX + pieceOffsetX;
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

						const offset = selectedPiece.gridOffset + pieceOffsetY * grid.tilesCountX + pieceOffsetX;
						if (selectedPiece.gridOffset % grid.tilesCountX + pieceOffsetX >= grid.tilesCountX ||
							(selectedPiece.gridOffset / grid.tilesCountY | 0) + pieceOffsetY >= grid.tilesCountY ||
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
							const offset = selectedPiece.gridOffset + pieceOffsetY * grid.tilesCountX + pieceOffsetX;
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
					selectedPiece.isMoving = false;
					pieceStick(selectedPiece.startMoveX, selectedPiece.startMoveY, selectedPiece);

					if (orgGridOffset !== -1) {
						// Write piece to original place
						for (let i = 0; i < selectedPiece.shape[2].length; i++) {
							const [pieceOffsetX, pieceOffsetY] = pieceCastRotation(selectedPiece, selectedPiece.rotateIndexOnGrid, i);
							gridTileFilled[selectedPiece.gridOffset + pieceOffsetY * grid.tilesCountX + pieceOffsetX] = 1;
						}
					}
				}
			} else {
				selectedPiece.isStickToGrid = false;
				if (orgGridOffset !== -1)
					gridTilesLeft += selectedPiece.shape[2].length;
			}

			let result = '';
			for (let i = 0; i < grid.tilesCountY; i++) {
				for (let j = 0; j < grid.tilesCountX; j++)
					result += gridTileFilled[i * grid.tilesCountX + j] + ' ';
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

	/**
	 * @param {int} positionX
	 * @param {int} positionY
	 * @param {int} threshold
	 * @param {Piece} piece
	 * @param {boolean} setOffset
	 */
	function findPointToStick(positionX, positionY, threshold, piece, setOffset) {
		let i = 0;
		const len = grid.tilesCountX * grid.tilesCountY * 2;
		for (let j = 0; j < len; j += 2) {
			const x = grid.anchorPoints[j], y = grid.anchorPoints[j + 1];
			let addX = false, addY = false;
			if (
				Math.abs(positionX - x) < threshold && Math.abs(positionY - y) < threshold ||
				(addX = (Math.abs(positionX + piece.w - tilesSize - x) < threshold)) && Math.abs(positionY - y) < threshold ||
				Math.abs(positionX - x) < threshold && (addY = (Math.abs(positionY + piece.h - tilesSize - y) < threshold)) ||
				(addX = (Math.abs(positionX + piece.w - tilesSize - x) < threshold)) && (addY = (Math.abs(positionY + piece.h - tilesSize - y) < threshold))
			) {
				if (setOffset)
					piece.gridOffset = addX || addY ? -1 : i;

				// Same point skip
				const toX = addX ? x - piece.w + tilesSize : x,
					toY = addY ? y - piece.h + tilesSize : y;
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

	/*
	 * Canvas functions
	 */
	function calculateAnchorPoints() {
		const canvasOffsetX = (mainCanvasElement.width - grid.canvasElement.width) * 0.5,
			canvasOffsetY = (mainCanvasElement.height - grid.canvasElement.height) * 0.5;

		grid.anchorPoints = new Uint32Array(grid.tilesCountX * grid.tilesCountY * 2);
		let k = 0;
		for (let i = 0; i < grid.tilesCountY; i++) {
			for (let j = 0; j < grid.tilesCountX; j++) {
				grid.anchorPoints[k++] = tilesSize * j + canvasOffsetX;
				grid.anchorPoints[k++] = tilesSize * i + canvasOffsetY;
			}
		}

		for (const piece of grid.piecesForLevel) {
			if (piece.isStickToGrid) {
				const offset = piece.gridOffset * 2;
				piece.x = grid.anchorPoints[offset];
				piece.y = grid.anchorPoints[offset + 1];
			}
		}
	}

	function resizeMainCanvas() {
		mainCanvasElement.width = window.innerWidth;
		mainCanvasElement.height = window.innerHeight;
	}

	function calculatePiecesMove() {
		for (/**@type Piece*/const piece of grid.piecesForLevel) {
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
				mainCanvasRefresh = true;
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
				mainCanvasRefresh = true;
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
				mainCanvasRefresh = true;
			}
		}
	}

	function renderPieces() {
		for (let i = grid.piecesForLevel.length - 1; i > -1; i--) {
			const piece = grid.piecesForLevel[i];
			mainCanvas.strokeStyle = 'red';
			mainCanvas.strokeRect(piece.x, piece.y, piece.w, piece.h);

			drawImage(piece.image, piece.rotateAngle,
				piece.x + (piece.w - piece.originalW) * 0.5, piece.y + (piece.h - piece.originalH) * 0.5,
				piece.originalW, piece.originalH);
		}
	}

	function renderGrid() {
		mainCanvas.drawImage(grid.bgCanvasElement,
			(mainCanvasElement.width - grid.bgCanvasSize) * 0.5, (mainCanvasElement.height - grid.bgCanvasSize) * 0.5,
			grid.bgCanvasSize, grid.bgCanvasSize);

		mainCanvas.drawImage(grid.canvasElement,
			(mainCanvasElement.width - grid.canvasElement.width) * 0.5,
			(mainCanvasElement.height - grid.canvasElement.height) * 0.5);
	}

	/*
	 * Loading functions
	 */
	function processGridBackgroundImage(gridBGImage) {
		console.time('Process grid background');
		const backgroundColor = 0xDBCEC6;
		const width = grid.bgCanvasElement.width = gridBGImage.width;
		const height = grid.bgCanvasElement.height = gridBGImage.height;
		const gridBGCanvas = grid.bgCanvasElement.getContext('2d');
		gridBGCanvas.drawImage(gridBGImage, 0, 0, width, height);
		const imageData = gridBGCanvas.getImageData(0, 0, width, height);
		const data = imageData.data;
		for (let i = 0; i < data.length; i += 4) {
			if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] !== 0) {
				data[i] = (backgroundColor >> 16) & 0xFF;
				data[i + 1] = (backgroundColor >> 8) & 0xFF;
				data[i + 2] = backgroundColor & 0xFF;
			}
		}
		gridBGCanvas.putImageData(imageData, 0, 0);
		console.timeEnd('Process grid background');
	}

	function processPiece(piecesData, resources) {
		// create piece
		for (let i = 0; i < resources.piecesImage.length; i++) {
			const w = piecesShape[i][0] * tilesSize, h = piecesShape[i][1] * tilesSize;
			// create piece
			piecesData[i] = new Piece(0, 0, w, h, i, piecesShape[i], resources.piecesImage[i]);
		}
	}

	/*
	 * Utils
	 */
	function easeInOut(t) {
		return t * t * (3 - 2 * t);
	}

	function drawImage(image, angel, x, y, w, h) {
		if (angel !== 0) {
			const wr = w * 0.5, hr = h * 0.5;
			mainCanvas.translate(x + wr, y + hr);
			mainCanvas.rotate(angel);
			mainCanvas.drawImage(image, -wr, -hr, w, h);
			mainCanvas.rotate(-angel);
			mainCanvas.translate(-x - wr, -y - hr);
		} else
			mainCanvas.drawImage(image, x, y, w, h);
	}
}