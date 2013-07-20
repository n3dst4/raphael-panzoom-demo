/*
 * panzoom_core.js
 */


(function($) {
    var el,
        options,
        floorplanUrl = "../floorplan.jpg",
        floorplanWidth = 1024,
        floorplanHeight = 1024,
        simulateKeyDownUp = function(el, kCode, shift) {
            el.simulate("keydown",{keyCode:kCode, shiftKey: shift || false })
                .simulate("keyup",{keyCode:kCode, shiftKey: shift || false });
        };
        
    function makeDiv () {
        this.el = $('<div>').width(512).height(512);
    }
    
    function makeLoadedWidgetNoData () {
        makeDiv.call(this);
        this.el.appendTo("body").panzoom({zoomStep: 2, minZoom: 1/8, maxZoom: 8}).
            panzoom("loadMap", floorplanUrl, floorplanWidth, floorplanHeight, {});
    }
    
    function makeLoadedWidgetWithData () {
        makeDiv.call(this);
        this.el.appendTo("body").panzoom({zoomStep: 2, minZoom: 1/8, maxZoom: 8}).
            panzoom("loadMap", floorplanUrl, floorplanWidth, floorplanHeight, [
                {x: 100, y: 100, status: "friend", locationId: 1}
            ]);
    }
    
    function clearDiv () {
        this.el.remove();
        this.el = undefined;
    }
    
    function clearWidget () {
        this.el.panzoom("destroy");
        clearDiv.call(this);
    }
    
    // Panzoom Tests
    module("panzoom: core widget", {setup: makeDiv, teardown: clearDiv});
    
    test("init", 1, function() {
        this.el.appendTo('body').panzoom().remove();
        ok(true, '.panzoom() called on element');
    });
    
    test("class", 1, function() {
        this.el.panzoom();
    	ok(this.el.hasClass('fsi-panzoom'), 'input gets fsi-panzoom class on init');        
    });
    
    
    test("destroy", 1, function() {
        this.el.appendTo('body').panzoom().panzoom("destroy").remove();
        ok(true, '.panzoom("destroy") called on element');
    });
    
    test("class is removed", 1, function() {
        this.el.panzoom().panzoom('destroy');
        ok(!this.el.hasClass('fsi-panzoom'), 'fsi-panzoom class removed on destroy');
    });
    
    
    test("re-attach", 1, function() {
        this.el.panzoom().panzoom("destroy").panzoom();
        ok(true, '.panzoom().panzoom("destroy").panzoom() called on element');
    });
    
    
    
    
    module("panzoom: basic operationss", {setup: makeLoadedWidgetNoData, teardown: clearWidget});
    
    test("load a map", 4, function() {
        var image = this.el.find("image");
        ok(image.length > 0, 'map loaded');
        equal(image.attr("href"), floorplanUrl, "floorplan url is right");
        equal(parseInt(image.attr("width"), 10), floorplanWidth, "floorplan is the right width");
        equal(parseInt(image.attr("height"), 10), floorplanHeight, "floorplan is the right height");
    });
    
    
    test("zoom in button", 1, function() {
        this.el.find(".fsi-panzoom-zoomin").click();
        equal(this.el.find("svg")[0].getAttribute("viewBox"), "128 128 256 256");
    });
    
    
    test("zoom out button", 1, function() {
        this.el.find(".fsi-panzoom-zoomout").click();
        equal(this.el.find("svg")[0].getAttribute("viewBox"), "0 0 1024 1024");
    });
    
    
    test("zoom reset button", 1, function() {
        this.el.find(".fsi-panzoom-zoomin").click();
        this.el.find(".fsi-panzoom-zoomout").click();
        equal(this.el.find("svg")[0].getAttribute("viewBox"), "0 0 512 512");
    });


    test("dragging", 1, function() {
        this.el.find("image").simulate("drag", {dx: -10, dy: -20});
        equal(this.el.find("svg")[0].getAttribute("viewBox"), "10 20 512 512");
    });


    test("dragging constraints (zoomed in)", 2, function() {
        this.el.find("image").simulate("drag", {dx: 100, dy: 200});
        equal(this.el.find("svg")[0].getAttribute("viewBox"), "0 0 512 512");
        this.el.find("image").simulate("drag", {dx: -5000, dy: -5000});
        equal(this.el.find("svg")[0].getAttribute("viewBox"), "512 512 512 512");
    });


    test("dragging constraints (zoomed out)", 2, function() {
        this.el.find(".fsi-panzoom-zoomout").click().click();
        this.el.find("image").simulate("drag", {dx: 5000, dy: 5000});
        equal(this.el.find("svg")[0].getAttribute("viewBox"), "-1024 -1024 2048 2048");
        this.el.find("image").simulate("drag", {dx: -5000, dy: -5000});
        equal(this.el.find("svg")[0].getAttribute("viewBox"), "0 0 2048 2048");
    });



    //module("panzoom: node operations", {setup: makeLoadedWidgetWithData, teardown: clearWidget});

    // clicking a node
    
    
})(jQuery);































