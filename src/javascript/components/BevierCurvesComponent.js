import _ from 'underscore';
import { TweenLite } from 'gsap/TweenLite';
import * as dat from 'dat.gui';


import DistanceUtil from '../utils/DistanceUtil';

class BezierCurvesComponent {
    constructor() {

        _.bindAll(
            this,
            '_tickHandler',
            '_resizeHandler',
            '_dragHandler',
            '_mouseDownHandler',
            '_removeDragEvent',
            '_buttonMouseUpHandler',
            '_getCurveValues',
            '_updateValues'
        );
        
        this.ui = {
            canvas: document.querySelector('.js-bezier-curves-component')
        }

        this._settings = {
            dateStart: '07-03-2019',
            xMin: 0, // date
            xMax: 100, //amount of days 
            yMin: 50, // value
            yMax: 400,
            bezierPoints: [ 
                { x: 0, y: 300 },
                { x: 600, y: 600 },
                // { x: 1000, y: 600 },
            ],
            speed: 5,
            drawCurve: false,
            allowBallDeltaAnimation: false,
            allowBallAnimation: false,
            allowBallXAnimation: false,   
            clear: true,
            shccAnim: false
        };


        this._delta = 0;
        this._sign = 1;

        const gui = new dat.GUI();
        
        gui.add(this._settings, 'xMax').min(2).onChange(this._updateValues);
        gui.add(this._settings, 'xMin').onChange(this._updateValues);
        gui.add(this._settings, 'speed').min(1).max(100).step(0.5);
        gui.add(this._settings, 'allowBallDeltaAnimation');
        gui.add(this._settings, 'clear');
        gui.add(this._settings, 'allowBallAnimation');
        gui.add(this._settings, 'drawCurve');
        gui.add(this._settings, 'allowBallXAnimation');
        gui.add(this._settings, 'shccAnim');

        this._init();
        this._setup();
    }

    _init() {
        this._canvas = this.ui.canvas; 
        this._canvas.style.backgroundColor = 'black';
        this._ctx = this._canvas.getContext('2d');
        this._enablePreviewMode = false;
        this._pointsOnCurve = [];
        this._scale = {
            x: 100,
            y: 100
        };
        this._origin = {
            x: 100,
            y: 1000
        };
    }

    _setup() {
        this._resize();
        this._initPoints();
        this._initControlPoints();
        this._initCurves();
        this._setupEventListener();
    }

    _createLandMarks() {
        const scaleX = this._scale.x;
        const scaleY = this._scale.y;
        const verticalLinesCount = Math.floor(this._canvas.width / scaleX);
        const horizontalLinesCount = Math.floor(this._canvas.height / scaleY);

        this._ctx.strokeStyle = 'rgba(150,150,150, 1)';
        this._ctx.lineWidth = 0.5;

        for (let i = 0; i <= verticalLinesCount; i++) {
            this._ctx.beginPath();
            this._ctx.moveTo(0 + scaleX * i, 0);
            this._ctx.lineTo(0 + scaleX * i, this._canvas.height);
            this._ctx.stroke();
        }
        
        for (let i = 0; i <= horizontalLinesCount; i++) {
            this._ctx.beginPath();
            this._ctx.moveTo(0, 0 + scaleY * i);
            this._ctx.lineTo(this._canvas.width, 0 +  + scaleY * i);
            this._ctx.stroke();
        }
    }

    _createOrthonormal() {
        const minX = this._origin.x;
        const minY = this._origin.y;


        this._ctx.strokeStyle = 'rgba(150,150,150, 1)';
        this._ctx.lineWidth = 0.5;

        this._ctx.beginPath();
        this._ctx.moveTo(minX, 0);
        this._ctx.lineTo(minX, this._canvas.height);
        this._ctx.moveTo(0, minY);
        this._ctx.lineTo(this._canvas.width, minY);
        this._ctx.stroke();
    }

    _createButtons() {
        this._previewButton = {
            id: 'preview',
            x: 50, 
            y: 50,
            width: 100,
            height: 50,
            content: 'Preview'
        };

        this._exportButton = {
            id: 'export',
            x: 200,
            y: 50,
            width: 100,
            height: 50,
            content: 'Export'
        };

        this._buttons = [this._previewButton, this._exportButton];

        //PREVIEW
        this._ctx.beginPath();
        this._ctx.rect(this._previewButton.x, this._previewButton.y, this._previewButton.width, this._previewButton.height);
        this._ctx.fillStyle = 'white';
        this._ctx.font = 'normal 15px arial, sans-serif';
        this._ctx.textAlign = 'center';
        this._ctx.textBaseline = 'middle';
        this._ctx.fillText('Preview', this._previewButton.x + this._previewButton.width/2, this._previewButton.y + this._previewButton.height/2);

        //EXPORT
        this._ctx.beginPath();
        this._ctx.rect(this._previewButton.x, this._exportButton.y, this._exportButton.width, this._exportButton.height);
        this._ctx.fillStyle = 'white';
        this._ctx.font = 'normal 15px arial, sans-serif';
        this._ctx.textAlign = 'center';
        this._ctx.textBaseline = 'middle';
        this._ctx.fillText(this._exportButton.content, this._exportButton.x + this._exportButton.width/2, this._exportButton.y + this._exportButton.height/2);
    }

    _initPoints() {
        const minX = this._origin.x;
        const minY = this._origin.y;
        this._points = [];

        let data = this._settings.bezierPoints;

        for (let i = 0; i < data.length; i++) {
            let point = {
                x: data[i].x + minX,
                y: - data[i].y + minY
            };
            this._points.push(point);
        }
    }

    _initControlPoints() {
        this._controlPoints = [];
        
        const limit = (this._points.length * 2) - 2;

        for (let i = 0; i < limit; i++) {
            //INIT 2 FIRST CONTROL POINTS
            if (i < 2) {
                const point = {
                    x: 150 + (100*i),
                    y: 500 + (- 100*i),
                };
                this._controlPoints.push(point);
            } else if (i >= 2 && (i % 2) == 0) {
                //MATCH PREVIOUS ANGLE
                const anchorPoint1 = this._points[i/2-1];
                const anchorPoint2 = this._points[i/2];
                const controlPoint1 = this._controlPoints[i-2];
                const controlPoint2 = this._controlPoints[i-1];
                
                let curve = {
                    points: [anchorPoint1, anchorPoint2],
                    controlPoints: [controlPoint1, controlPoint2]
                };

                const point = this._getBezierAngle(curve, 1);
                this._controlPoints.push(point);
            } else {
                //NEW RANDOM CONTROL POINT
                const point = {
                    x: 150,
                    y: 500,
                };
                this._controlPoints.push(point);
            }
        }
    }

    _initCurves() {  
        this._curves = [];
        this._controls = [];

        //CREATE PAIRS OF CONTROL POINTS
        for (let i = 0; i < this._controlPoints.length - 1; i+=2) {
            let control = {
                controlPoint1: this._controlPoints[i],
                controlPoint2: this._controlPoints[i+1]
            };
            this._controls.push(control);
        }

        //CREATE CURVE WITH POINTS
        for (let i = 0; i < this._points.length - 1; i++) {
            let curve = {
                points: [this._points[i], this._points[i+1]],
                controlPoints: []
            };
            this._curves.push(curve);
        }

        //ADD CONTROL POINTS PAIRS TO CURVE
        for (let i = 0; i < this._curves.length; i++) {
            this._curves[i].controlPoints = [this._controls[i].controlPoint1, this._controls[i].controlPoint2];
        }
    }

    _createPoints() {
        this._ctx.fillStyle = 'red';
        for (let i = 0; i < this._points.length; i++) {
            this._ctx.beginPath();
            this._ctx.arc(this._points[i].x, this._points[i].y, 5, 0, 2 * Math.PI);
            this._ctx.arc(this._points[i].x, this._points[i].y, 5, 0, 2 * Math.PI);
            this._ctx.fill();
        }
    }

    _createControlPoint() {
        this._ctx.fillStyle = 'white';

        const radius = 4;
        
        for (let i = 0; i < this._controlPoints.length; i++) {
            this._ctx.beginPath();
            this._ctx.arc(this._controlPoints[i].x, this._controlPoints[i].y, radius, 0, 2 * Math.PI);
            this._ctx.fill();
        }
    }

    _createCurve() {
        if (!this._settings.drawCurve) return;

        this._ctx.strokeStyle = 'rgba(255,255,255, 1)';
        this._ctx.lineWidth = 1;

        const limit = this._curves.length;

        this._ctx.beginPath();

        for (let i = 0; i < limit; i++) {
            this._ctx.moveTo(this._curves[i].points[0].x, this._curves[i].points[0].y);
            this._ctx.bezierCurveTo(this._curves[i].controlPoints[0].x, this._curves[i].controlPoints[0].y, this._curves[i].controlPoints[1].x, this._curves[i].controlPoints[1].y, this._curves[i].points[1].x, this._curves[i].points[1].y); 
        }
        
        this._ctx.stroke();
    }

    _createTangent() {
        this._ctx.strokeStyle = 'rgba(255,0,0, 0.5)';
        this._ctx.lineWidth = 0.5;

        for (let i = 0; i < this._controlPoints.length; i++){
            this._ctx.beginPath();
            this._ctx.moveTo(this._controlPoints[i].x, this._controlPoints[i].y);
            if (i == 0) {
                this._ctx.lineTo(this._points[i].x, this._points[i].y);
            } else if (i == this._controlPoints.length - 1) {
                this._ctx.lineTo(this._points[this._points.length - 1].x, this._points[this._points.length - 1].y);
            } 
            else if (i%2 != 0) {
                this._ctx.lineTo(this._controlPoints[i+1].x, this._controlPoints[i+1].y);
            }
            this._ctx.stroke();
        }
    }

    _createPointsOnCurve() {
        if (!this._exportPoints) return;

        const radius = 5;
        this._ctx.fillStyle = 'yellow';

        for (let i = 0; i < this._exportPoints.length; i++) {
            this._ctx.beginPath();
            this._ctx.arc(this._exportPoints[i].x, this._exportPoints[i].y, radius, 0, 2 * Math.PI);
            this._ctx.arc(this._exportPoints[i].x, this._exportPoints[i].y, radius, 0, 2 * Math.PI);
            this._ctx.fill();
        }
    }

    //TEST GETTING VALUES OUT OF CURVES
    _createBall() {
        if (!this._ball) return;

        this._ctx.fillStyle = 'blue';
        this._ctx.beginPath();
        this._ctx.arc(this._ball.x, this._ball.y, 10, 0, 2 * Math.PI);
        this._ctx.arc(this._ball.x, this._ball.y, 10, 0, 2 * Math.PI);
        this._ctx.fill();
    }

    _createBallX() {
        if (!this._ball || !this._settings.allowBallXAnimation) return;

        this._ctx.fillStyle = 'red';
        this._ctx.beginPath();

        this._ctx.arc(this._ball.x, 300, 10, 0, 2 * Math.PI);        
        
        this._ctx.fill();
    }

    _createBallDelta() {
        if (!this._settings.allowBallDeltaAnimation) return;

        this._ctx.fillStyle = 'rgba(100, 100, 100, 1)';
        this._ctx.beginPath();
        
        this._ctx.arc((this._delta * 600) + 100, 200, 10, 0, 2 * Math.PI);
        
        this._ctx.fill();
    }

    _updateControlPoint(e) {
        //UPDATE DISPLAY CONTROL POINT
        this._controlPoints[this._currentTarget.index] = {
            x: e.clientX,
            y: e.clientY
        };

        //UPDATE CONTROL POINTS IN CURVE OBJECT
        let index = this._currentTarget.index;
        let curveIndex = this._currentTarget.curveIndex;
        let controlPointIndex = this._currentTarget.controlPointIndex;

        this._curves[curveIndex].controlPoints[controlPointIndex] = {
            x: e.clientX,
            y: e.clientY
        };

        //UPDATE RELATIVE CONTROL POINT
        let angle = this._getSymmetricPoint(this._curves[curveIndex].controlPoints[controlPointIndex], this._curves[curveIndex].points[controlPointIndex]); 

        if (this._curves[curveIndex - 1] && controlPointIndex == 0) {
            this._curves[curveIndex - 1].controlPoints[1] = angle; 
            this._controlPoints[index - 1] = angle;
        } else if (this._curves[curveIndex + 1] && controlPointIndex == 1) {
            this._curves[curveIndex + 1].controlPoints[0] = angle;
            this._controlPoints[index + 1] = angle;
        }

        //RESET POINTS ON CURVE
        this._exportPoints = [];
    }

    _updatePoint(e, index) {
        //UPDATE DISPLAY POINT
        const translate = DistanceUtil.getDistance(this._points[index], { x: e.clientX, y: e.clientY });

        this._points[index] = {
            x: e.clientX,
            y: e.clientY
        };

        if (index == 0) {
            this._controlPoints[index].x +=  - translate.x;
            this._controlPoints[index].y +=  - translate.y;
        } else if (index == this._points.length - 1) {
            this._controlPoints[index * 2 - 1].x +=  - translate.x;
            this._controlPoints[index * 2 - 1].y +=  - translate.y;
        } else {
            this._controlPoints[index * 2 - 1].x +=  - translate.x;
            this._controlPoints[index * 2 - 1].y +=  - translate.y;
            
            this._controlPoints[index * 2].x +=  - translate.x;
            this._controlPoints[index * 2].y +=  - translate.y;
        }

        //UPDATE CURVE
        this._initCurves();

        //RESET POINTS ON CURVE
        this._exportPoints = [];
    }

    _updateValues() {
        this._exportPoints = [];
    }

    _animateBall(t) {
        if (!this._settings.allowBallAnimation) return;

        let sx = this._curves[0].points[0].x;
        let sy = this._curves[0].points[0].y;
        let ex = this._curves[0].points[1].x;
        let ey = this._curves[0].points[1].y;
        
        let cp1x = this._curves[0].controlPoints[0].x;
        let cp1y = this._curves[0].controlPoints[0].y;
        let cp2x = this._curves[0].controlPoints[1].x;
        let cp2y = this._curves[0].controlPoints[1].y;

        this._ball = {
            x: Math.pow(1-t, 3) * sx + 3 * t * Math.pow(1 - t, 2) * cp1x + 3 * t * t * (1 - t) * cp2x + t * t * t * ex,
            y: Math.pow(1-t, 3) * sy + 3 * t * Math.pow(1 - t, 2) * cp1y + 3 * t * t * (1 - t) * cp2y + t * t * t * ey
        };
    }

    _animateShcc() {
        if (!this._ball) return;

        let anim = document.querySelector('.anim-shcc');

        let element = document.querySelectorAll('.title');
        let el = element[0];
        let el1 = element[1];
        let cover = document.querySelector('.coverRed');
        let animValue = (this._ball.x - 100) / 600;

        el.style.transform = `translate(${animValue * 50}px, -50%)`;
        el1.style.transform = `translate(${animValue * 50}px, -50%)`;
        cover.style.width = `${100 - animValue * 100}vw`;

        if (this._settings.shccAnim == false) {
            anim.style.display = 'none';
        } else if (this._settings.shccAnim == true) {
            anim.style.display = 'block';
        }
    }
    
    _analyzeCurve() {
        this._enablePreviewMode = true;

        //EMPTY POINTS ON CURVE ARRAY
        this._pointsOnCurve = [];
        
        this._ball = {
            x: this._points[0].x,
            y: this._points[0].y
        };

        //INITIALIZE FIRST POINT
        const curves = [];
        curves.push(this._curves[0].points[0]);

        //CREATE GLOBAL CURVE ARRAY 
        for (let i = 0; i < this._curves.length; i++) {
            let controlPoint1 = this._curves[i].controlPoints[0];
            let controlPoint2 = this._curves[i].controlPoints[1];
            let point2 = this._curves[i].points[1];
            
            curves.push(controlPoint1);
            curves.push(controlPoint2);
            curves.push(point2);
        }
        
        //GO THROUGH THE CURVE
        this._tl = TweenLite.to(this._ball, 2, { paused: true, bezier: { type: 'cubic', values: curves, timeResolution: 20 }, ease: Power0.easeNone });

        this._tl.eventCallback('onUpdate', this._getCurveValues);
        this._tl.eventCallback('onComplete', () => {
            this._exportPoints = this._getFilteredCurveValues();
            this._export();
            this._enablePreviewMode = false;
        });
        
        const numSteps = 5000;
        for (let i=0; i<=numSteps; i++) {
            let progress = i/numSteps;
            this._tl.progress(progress);
        }
    }

    _getBezierAngle(curve, t) {
        let point1 = curve.points[0];
        let point2 = curve.points[1];
        let controlPoint1 = curve.controlPoints[0];
        let controlPoint2 = curve.controlPoints[1];

        var dx = Math.pow(1-t, 2)*(controlPoint1.x-point1.x) + 2*t*(1-t)*(controlPoint2.x-controlPoint1.x) + t * t * (point2.x - controlPoint2.x);
        var dy = Math.pow(1-t, 2)*(controlPoint1.y-point1.y) + 2*t*(1-t)*(controlPoint2.y-controlPoint1.y) + t * t * (point2.y - controlPoint2.y);

        this._ctx.fillStyle = 'green';
        this._ctx.beginPath();
        this._ctx.arc(point2.x + dx, point2.y + dy, 5, 0, 2 * Math.PI);
        this._ctx.arc(point2.x + dx, point2.y + dy, 5, 0, 2 * Math.PI);
        this._ctx.fill();

        return { x: point2.x + dx, y: point2.y + dy };
    }

    _getSymmetricPoint(basePoint, axePoint) {
        let symmetricPoint = {
            x: axePoint.x + (axePoint.x - basePoint.x),
            y: axePoint.y + (axePoint.y - basePoint.y)
        };

        return symmetricPoint;
    }

    _setActiveTangent() {
        if (!this._currentTarget) return;
        if (this._currentTarget.type == 'point') return;
        
        const index = this._currentTarget.index;
        let curveIndex = this._currentTarget.curveIndex;
        let controlPointIndex = this._currentTarget.controlPointIndex;
        let symmetricPoint = this._getSymmetricPoint(this._controlPoints[index], this._curves[curveIndex].points[controlPointIndex]);

        this._ctx.strokeStyle = 'rgba(255,0,0, 1)';
        this._ctx.lineWidth = 0.5;
        this._ctx.beginPath();
        this._ctx.moveTo(this._controlPoints[index].x, this._controlPoints[index].y);
        if (index >= 1 && index < this._controlPoints.length - 1) {
            this._ctx.lineTo(symmetricPoint.x, symmetricPoint.y);
        } else {
            this._ctx.lineTo(this._curves[curveIndex].points[controlPointIndex].x, this._curves[curveIndex].points[controlPointIndex].y);
        }
        this._ctx.stroke();
    }

    _setActivePoint() {
        let index = this._currentTarget.index;
        
        if (index == 0) {
            this._currentTarget.activeCurves = [this._curves[index]];
        } else if (index == this._points.length - 1) {
            this._currentTarget.activeCurves = [this._curves[index - 1]];
        } else {
            this._currentTarget.activeCurves = [this._curves[index - 1], this._curves[index]];
        }
    }

    _getCurveValues() {
        const step = - Math.round(DistanceUtil.getDistance(this._points[0], this._points[this._points.length - 1]).x / this._settings.xMax - this._settings.xMin);
        const stepNumber = Math.round(DistanceUtil.getDistance(this._points[0], this._points[this._points.length - 1]).x / step);

        for (let i = 0; i <= - stepNumber; i++) {
            if (Math.round(this._ball.x) == step * i + this._points[0].x) {
                this._pointsOnCurve.push({ x: this._ball.x, y: this._ball.y });
            }
        }
    }

    _getFilteredCurveValues() {
        const values = this._pointsOnCurve;
        const accuracyX = 1;
        const accuracyY = 0.1;
        let toDelete = [];

        for (let i = 0; i < values.length; i++) {
            if (i > 0 && i < values.length - 1) {
                let roundValue = {
                    x: Math.round(values[i].x * accuracyX) / accuracyX,
                    y: Math.round(values[i].y * accuracyY) / accuracyY
                };
                let roundValue1 = {
                    x: Math.round(values[i+1].x * accuracyX) / accuracyX,
                    y: Math.round(values[i+1].y * accuracyY) / accuracyY
                };

                if (
                    roundValue.x == roundValue1.x 
                ) {
                    toDelete.push(i+1);
                }
            }              
        }

        for (let i = toDelete.length - 1; i >= 0; i--) {
            values.splice(toDelete[i], 1);
        }

        return values;
    }

    _export() {
        let json = JSON.stringify(this._exportPoints);
        let el = document.createElement('input');
        el.setAttribute('readonly', '');
        el.value = json;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);

        let successMsg = document.createElement('div');
        successMsg.innerHTML = 'Copied to clipboard';
        successMsg.setAttribute('style', 'position: absolute; top: 75px; left: 300px; transform: translateY(-50%); color: rgba(255,0,0,0.7);');
        document.body.appendChild(successMsg);

        setTimeout(function() {
            document.body.removeChild(successMsg);
        }, 750);
    }

    _draw() {
        if (this._settings.clear) {
            this._ctx.clearRect(0, 0, this._width, this._height);
        }
        // this._ctx.clearRect(0, 0, this._width, this._height);
        this._createLandMarks();
        this._createOrthonormal();
        this._createCurve();
        this._createButtons();

        if (this._delta >= 1) {
            this._delta = 0;
        }

        this._delta += this._settings.speed * 0.001;  
        
        this._animateBall(this._delta);
        
        this._createBall();
        this._createBallX();
        this._createBallDelta();
        this._animateShcc();

        if (this._enablePreviewMode) return;
        this._createPoints();
        this._createControlPoint();
        this._createTangent();
        this._setActiveTangent();

        this._createPointsOnCurve();
    }

    _tick() {
        this._draw();
    }

    _resize() {
        this._width = window.innerWidth;
        this._height = window.innerHeight;
        this._canvas.width = this._width;
        this._canvas.height = this._height; 
    }

    _setupEventListener() {
        window.addEventListener('resize', this._resizeHandler);

        window.addEventListener('mousedown', this._mouseDownHandler);

        TweenLite.ticker.addEventListener('tick', this._tickHandler);
    }

    _setupDragEvent() {
        window.addEventListener('mousemove', this._dragHandler);
    }

    _removeDragEvent() {
        window.removeEventListener('mousemove', this._dragHandler);
        this._cursorStyleHandler('inherit');
    }

    _buttonMouseUpHandler() {
        this._enablePreviewMode = false;
    }

    _tickHandler() {
        this._tick();
    }

    _resizeHandler() {
        this._resize();
    }

    _mouseDownHandler(e) {
        this._controlPointLocationHandler(e);
        this._pointLocationHandler(e);
        this._buttonLocationHandler(e);

        window.addEventListener('mouseup', this._removeDragEvent);
    }

    _dragHandler(e) {
        if (this._currentTarget.type == 'controlPoint') {
            this._updateControlPoint(e, this._currentTarget.index);
        } else if (this._currentTarget.type == 'point') {
            this._updatePoint(e, this._currentTarget.index);
        }
    }

    _pointLocationHandler(e) {
        const radius = 15;
        for (let i = 0; i < this._points.length; i++) {
            if (this._points[i].x - radius < e.clientX && e.clientX <= this._points[i].x + radius && this._points[i].y - radius < e.clientY && e.clientY <= this._points[i].y + radius) {
                this._currentTarget = {
                    type: 'point',
                    index: i
                };
                this._cursorStyleHandler('move');
                this._setActivePoint();
                this._updatePoint(e, this._currentTarget.index);
                this._setupDragEvent();
            }
        }
    }

    _controlPointLocationHandler(e) {
        const radius = 15;
        for (let i = 0; i < this._controlPoints.length; i++) {
            if (this._controlPoints[i].x - radius < e.clientX && e.clientX <= this._controlPoints[i].x + radius && this._controlPoints[i].y - radius < e.clientY && e.clientY <= this._controlPoints[i].y + radius) {
                this._currentTarget = {
                    type: 'controlPoint',
                    index: i,
                    curveIndex: Math.floor(i/2),
                    controlPointIndex: i % 2
                };
                this._cursorStyleHandler('move');
                this._updateControlPoint(e);
                this._setupDragEvent();
            }
        }
    }

    _buttonLocationHandler(e) {
        let btn = this._buttons;
        for (let i = 0; i < btn.length; i++) {
            if (e.clientX > btn[i].x && e.clientX < btn[i].x + btn[i].width && e.clientY < btn[i].y + btn[i].height && e.clientY > btn[i].y) {
                if (btn[i].id == 'preview') {
                    this._enablePreviewMode = true;
                    window.addEventListener('mouseup', this._buttonMouseUpHandler);
                } else if (btn[i].id == 'export') {
                    this._analyzeCurve();
                }
            } 
        } 
    }

    _cursorStyleHandler(type) {
        document.body.style.cursor = type;
    }

}

export default new BezierCurvesComponent();