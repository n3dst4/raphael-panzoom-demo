(function (global, $) {
    "use strict";
    var defaultZoomStep = 1.1,
        defaultZoomStepsIn = 10,
        defaultZoomStepsOut = defaultZoomStepsIn,
        //console = console || {log:$.noop},
        wrapperClass = "fsi-panzoom";
        
    var freeTransformOptions = {
        draw: ["bbox"],
        rotate: ['axisX', 'axisY'],
        scale: ['bboxCorners', 'bboxSides' ],
        snap: { rotate: 15 }
    };        
        
    /* A note about pixels and coordinates:
     * This widget represents a map, with certain pixel dimensions, which can
     * be zoomed in and out. The level of zoom is represented by a zoom factor,
     * which defaults to 1, meaning that map pixels == screen pixels. Zoom 2
     * would mean that everything on the map looks twice as large.
     * So "map pixels" are the virtual pixels of the floorplan image that's
     * been loaded; "screen pixels" are the literal pixels in the viewport.
     *
     * To convert:
     * map pixels * zoom = screen pixels
     * screen pixels / zoom = map pixels
     */

    /*
     * Helper for constraining viewport position. This function is called once
     * for x-position and once for y-position (the logic is the same whether
     * you're counting horizontally or vertically.)
     * @param coord The desired map-pixels x or y coordinate for the top left
     *  of the viewport.
     * @param zoom The current level of zoom
     * @param mapDim The dimension (width or height) of the map
     * @param viewDim The dimension (width or height) of the viewport
     * @returns The constrained dimension
     */
    function constrain (coord, zoom, mapDim, viewDim) {
        if (mapDim*zoom < viewDim) {
            // map can fit inside viewport
            coord = Math.max(coord, (-1 * viewDim / zoom) + mapDim);
            coord = Math.min(coord, 0);
        }
        else {
            // map is larger than viewport
            coord = Math.max(coord, 0);
            coord = Math.min(coord, mapDim - viewDim / zoom);
        }
        return coord;
    }
    
    
    // panzoom widget
    $.widget("fsi.panzoom", {
        options: {
            plan_image_url: "",
            width: 0,
            height: 0,
            strings: {},
            initZoom: 1,
            zoomStep: defaultZoomStep,
            maxZoom: Math.pow(defaultZoomStep, defaultZoomStepsIn),
            minZoom: Math.pow(1/defaultZoomStep, defaultZoomStepsOut),
            cornerRadius: 5,
            colours: {
                vacant: "#9bdd91",
                busy: "#8e8e8e",
                friend: "#e93e3e"
            },
            defaultColour: "#fff",
            pointWidth: 30,
            pointHeight: 30,
            momentumDuration: 1000,
            momentumEasing: "easeOutCubic",
            nodeClick: $.noop
        },
        

        ////////////////////////////////////////////////////////////////////////
        // PRIVATE METHODS
        ////////////////////////////////////////////////////////////////////////        
        
        /**
         * Create the panzoom widget
         * @class panzoom
         * @constructs
         */
        _create: function(){
            var opts = this.options;
            if (opts.width) this.element.width(opts.width);
            if (opts.height) this.element.height(opts.height);
            
            this.element.addClass(wrapperClass);
            
            this._paper = Raphael(this.element[0],
                                  this.element.width(),
                                  this.element.height());
            this._set = this._paper.set();
            this._zoom = this.options.initZoom;

            this._createButtons();
            this._initMousewheel();
        },
        
        
        /**
         * Set up draggability of canvas area
         */
        _initDragging: function() {
            var velX, velY, // mouse drag "velocity" in map pixels
                self = this,
                dragX = 0, // mouse movement in map pixels since dragging began
                dragY = 0;
            this._x = 0;
            this._y = 0;
            this._map.drag(
                // drag move
                function(dx, dy, absx, absy, event){
                    velX = dx / this._zoom - dragX;
                    velY = dy / this._zoom - dragY;
                    dragX += velX;
                    dragY += velY;
                    this._render(dragX, dragY);
                },
                //drag start
                function(){
                    this._stopAnimating = true;
                    //if (Raphael.vml) this._set.hide();
                },
                // drag end
                function(event) {
                    //if (Raphael.vml) this._set.show();
                    if (dragX) { this._setX(this._x - dragX); }
                    if (dragY) { this._setY(this._y - dragY); }
                    this._render();
                    //this._startMomentum(velX, velY);
                    dragX = 0;
                    dragY = 0;
                    velX = 0;
                    velY = 0;
                },
                this, this, this // context objects for the drag callbacks
            );
        },
        
        
        /**
         * Start the map moving under "momentum"
         */
        _startMomentum: function(dx, dy) {
            if (!Raphael.svg) return;
            var self = this,
                from = {x: this._x, y: this._y},
                to = {x: this._x - dx*10, y: this._y - dy*10 };
            jQuery(from).animate(to, {
                duration: this.options.momentumDuration,
                step: function(){
                    self._setX(this.x);
                    self._setY(this.y);
                    self._render();
                    if (self._stopAnimating) {
                        $(this).stop();
                        self._stopAnimating = false;
                    }
                },
                easing: this.options.momentumEasing
            });
        },
        
        
        /**
         * Create zoom buttons
         */
        _createButtons: function () {
            var self = this,
                butonDock = $("<div class='panzoom-button-area'></div>").
                appendTo(this.element);
                
            function addButton(text, cls, icon, callback) {
                $("<button>" + self._t(text) + "</button>").addClass(cls).
                button({
                    text: !icon,
                    icons: {primary: icon}
                }).
                click($.proxy(callback, self)).
                appendTo(butonDock);
            }
            addButton("Zoom Out", "fsi-panzoom-zoomout",   "ui-icon-minusthick", this.zoomOut);
            addButton("1:1",      "fsi-panzoom-zoomreset", null,                 this.zoomReset);
            addButton("Zoom In",  "fsi-panzoom-zoomin",    "ui-icon-plusthick",  this.zoomIn);
        },
        
        
        /**
         * Set up mouse wheel interactions for zooming
         */
        _initMousewheel: function () {
            if (typeof $.fn.mousewheel === "undefined") return;
            this.element.mousewheel($.proxy(function(event, delta) {
                event.preventDefault();
                this[delta>0?"zoomIn":"zoomOut"](event, true);
                return false;
            }, this));
        },
        
        
        /**
         * Creates a naff coordinate-showing tool (dev only)
         */
        _createTool: function() {
            var text;
            if (this._tool) this._tool.remove();
            if (this._toolText) this._toolText.remove();
            if (! this.options.showTool) { return; }
            
            this._tool = this._paper.rect(0,0,100,20,0).
                    attr("fill", "#fff").
                    attr("stroke", "#000");
            this._toolText = this._paper.text(0,0, "foo");
            this._tool.drag(
                function(dx, dy, x, y, event){
                    var newX = Math.floor((x / this._zoom) + this._x),
                        newY = Math.floor((y / this._zoom) + this._y);
                    this._tool.attr({x: newX, y: newY});
                    this._toolText.attr(
                        {x: newX+50, y: newY+10,"text": newX + ", " + newY});
                },
                null,
                function(event){
                    
                },
                this,this,this
            );
        },
        
        
        /**
         * Move to drawing area to current coordinates and zoom
         * dx and dy are used while dragging to provide a temporary offset from
         * the starting coordinates.
         * @param {Number} [dx] Temporary rendering x-offset
         * @param {Number} [dy] Temporary rendering y-offset
         */
        _render: function (dx, dy) {
            dx = dx || 0;
            dy = dy || 0;
            this._paper.setSize(this.element.width(), this.element.height());
            var x = constrain(this._x - dx, this._zoom,
                    this._mapWidth, this.element.width()),
                y = constrain(this._y - dy, this._zoom,
                    this._mapHeight, this.element.height()),
                w = this.element.width() / this._zoom,
                h = this.element.height() / this._zoom;
            //this._map.attr("clip-rect", [x, y, w, h].join(" "));
            this._paper.setViewBox(x, y, w, h, false);
        },
        
        
        /**
         * Set x-offset, in virtual "map" pixels, of LHS of viewport
         */
        _setX: function(newX) {
            this._x = constrain(newX, this._zoom,
                                this._mapWidth, this.element.width());
        },
        
        
        /**
         * Set y-offset, in virtual "map" pixels, of top of viewport
         */
        _setY: function(newY) {
            this._y = constrain (newY, this._zoom,
                                 this._mapHeight, this.element.height());
        },
        
        
        /**
         * Get a translation string
         */
        _t: function (key) {
            return this.options.strings[key] || key;
        },
        
        
        _edit: function (element) {
            if (this._currentEdit && this._currentEdit.subject == element) return;
            this._clearEdit();
            element.toFront();
            this._currentEdit = this._paper.freeTransform(element, freeTransformOptions);            
        },
        
        
        _clearEdit: function () {
            if (this._currentEdit) {
                this._currentEdit.unplug();
                this._currentEdit = null;
            }
        },  
        
        /**
         * Add a clickable node to the map
         */
        _addPoint: function (point){
            var self = this,
                set = this._set,
                paper = this._paper,
                opts = this.options;
            var rect = paper.rect(
                point.x,
                point.y,
                point.width || opts.pointWidth,
                point.height || opts.pointHeight,
                opts.cornerRadius
            );
            rect.attr({
                "fill": opts.colours[point.status] || opts.defaultColour
            });
            rect.data("locationId", point.locationId);
            set.push(rect);
            rect.click(function(event){
                self._edit(this);
            });
        },

        
        ////////////////////////////////////////////////////////////////////////
        // PUBLIC METHODS
        ////////////////////////////////////////////////////////////////////////
        
        /**
         * Remove widget
         */
        destroy: function () {
            this.element.removeClass("fsi-panzoom");
        },
        
        
        /**
         * Zoom in by one step
         */
        zoomIn: function(event, useCoords) {
            this.zoomTo(this._zoom * this.options.zoomStep, event, useCoords);
        },
        
        
        /**
         * Zoom out by one step
         */
        zoomOut: function(event, useCoords) {
            this.zoomTo(this._zoom  / this.options.zoomStep, event, useCoords);
        },

        
        /**
         * Reset zoom to initial value (default: 1)
         */
        zoomReset: function(event) {
            this.zoomTo(this.options.initZoom, event);
        },

        
        /**
         * Zoom to a specific zoom factor
         * @param factor The level to zoom to go to (higher = zoomed in)
         * @param event The DOM event which caused the change, if any
         * @param useCoords If true, will use mouse pos from event to centre
         *      zoom.
         */
        zoomTo: function (factor, event, useCoords) {
            var fixX, fixY, // map coordinates to keep stationary in viewport
                viewX, viewY, // screen coordinates where fixX/Y should be fixed
                offsets, 
                opts = this.options;
            
            if (useCoords) {
                // we ought be able to use event.offsetX/Y. but they are
                // undefined in FF, and broken in IE.
                offsets = this.element.offset();
                viewX = event.pageX - offsets.left;
                viewY = event.pageY - offsets.top;
                fixX = this._x + (viewX / this._zoom);
                fixY = this._y + (viewY / this._zoom);
            }
            else {
                // no mouse event, so just use centre of viewport
                fixX = this._x + ((this.element.width()/2) / this._zoom);
                fixY = this._y + ((this.element.height()/2) / this._zoom);
                viewX = this.element.width()/2;
                viewY = this.element.height()/2;
            }
            
            this._zoom = Math.min(Math.max(factor, opts.minZoom), opts.maxZoom);
            this._setX(fixX - (viewX / this._zoom));
            this._setY(fixY - (viewY / this._zoom));
            this._render();
        },
        
        
        /**
         * Load up a new location map
         * @param url The URL of the imge to load
         * @param  data An array of objects representing points on the map
         */
        loadMap: function (url, width, height, data) {
            var opts = this.options,
                paper = this._paper,
                set = this._set,
                self = this;
            if (this._map) { this._map.remove(); }
            this._set.remove();
            this._mapWidth = width;
            this._mapHeight = height;
            this._map = this._paper.image(
                url, 0, 0, width, height);
            this._initDragging();
            $.each(data, function (i, point){ self._addPoint(point); });
            this._createTool();
            this._map.click(function(){self._clearEdit()});
        }
        
        
    });
    



    
    
    
} (this, jQuery));

















































