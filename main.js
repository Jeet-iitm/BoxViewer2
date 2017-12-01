/* Copyright 2014 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/*
* namespace for box api specific controls
*/
var box = {};

/* Intializations */
box.viewedPages = {};
box.numPagesViewed = 0;
box.totalPages = 0;

if (!PDFJS.PDFViewer || !PDFJS.getDocument) {
  alert('Please build the pdfjs-dist library using\n' +
        '  `gulp dist-install`');
}

// The workerSrc property shall be specified.
//
PDFJS.workerSrc = 'pdf.worker.js';

// Some PDFs need external cmaps.
//
// PDFJS.cMapUrl = '../../node_modules/pdfjs-dist/cmaps/';
// PDFJS.cMapPacked = true;

box.moduleUrl = 'https://www.dropbox.com/s/er860hrjujostwo/Dropbox%20Getting%20Started.pdf?dl=1';
box.initialized = false;
var SEARCH_FOR = ''; // try 'Mozilla';

var container = document.getElementById('viewerContainer');

// Read query params
var moduleContentUrlParams = window.location.search.substring(1);
var paramsArray = moduleContentUrlParams.split("&");
for (var i=0; i<paramsArray.length; i++) {
  var sParameterName = paramsArray[i].split("=");
  if (sParameterName[0] === "moduleUrl") {
      box.moduleUrl = sParameterName[1] ? sParameterName[1].split("?")[0] : "";
  }
  if (sParameterName[0] === "parentApp") {
      box.callingapp = sParameterName[1];
      if (box.callingapp === "contentPlayer") {
      /* @ifndef  DEVICE_TARGET*/
          document.domain = "adobe.com";
      /* @endif */
      }
  }
}


// (Optionally) enable hyperlinks within PDF files.
var pdfLinkService = new PDFJS.PDFLinkService();

var pdfViewer = new PDFJS.PDFViewer({
  container: container,
  linkService: pdfLinkService,
});
pdfLinkService.setViewer(pdfViewer);

// (Optionally) enable find controller.
var pdfFindController = new PDFJS.PDFFindController({
  pdfViewer: pdfViewer
});
pdfViewer.setFindController(pdfFindController);

// Loading document.
PDFJS.getDocument(box.moduleUrl).then(function (pdfDocument) {
  // Document loaded, specifying document for the viewer and
  // the (optional) linkService.
  if (box.initialized) {
    return;
  }
  pdfViewer.setDocument(pdfDocument);

  pdfLinkService.setDocument(pdfDocument, null);
  box.ACAPInterface.setNumPagesFromEvent(pdfDocument);
  box.totalPages = pdfDocument.numPages;
});


container.addEventListener('pagesinit', function () {
  // We can use pdfViewer now, e.g. let's change default scale.
  if (box.initialized) {
    return;
  }
  pdfViewer.currentScaleValue = 'page-width';

  if (SEARCH_FOR) { // We can try search for things
    pdfFindController.executeCommand('find', {query: SEARCH_FOR});
  }
  box.onBoxDocumentViewable();
  box.initialized = true;
});

box.onBoxDocumentViewable = function() {
  box.ACAPInterface.updateCurrentPageFromEvent(pdfViewer);
  container.addEventListener('pagechange', box.ACAPInterface.updateCurrentPageFromEvent);
  // container.addEventListener("focus", box.ACAPInterface.updateCurrentPageFromEvent);
  // pdfViewer.eventBus.on('pageChange', box.ACAPInterface.updateCurrentPageFromEvent);
  var evt = document.createEvent("Event");
  evt.initEvent("moduleReadyEvent", true, true);
  evt.Data = box.ACAPInterface;

  /* after this call reporting options are set*/
  if (window.parent) {
    window.parent.dispatchEvent(evt);
  }

  pdfViewer.type = "ready";
  box.updatePagesViewed(pdfViewer);
  box.updateCompletionIfCriteriaMet(pdfViewer);
  box.updateSuccessIfCriteriaMet(pdfViewer);
  box.triggerStartedEvent(pdfViewer);

  box.getDataFromAcapPlayer();
  box.viewer = pdfViewer;
}


/**************************************************************************/


/********************************** tracking data**************************/
box.updatePagesViewed = function(event) {
    var page = event.currentPageNumber ? event.currentPageNumber : event.pageNumber;
    if(!box.viewedPages[page]) {
      box.viewedPages[page] = true;
      box.numPagesViewed++;
    }
    // box.viewer.currentPageNumber = page;
}


/*********************************tracking data ***************************/

/* Utlity functions and classes for reporting and analytics*/

box.ResumePlaybackCallbackFn = function(resumeDataPromise) {
    resumeDataPromise.then( function(previousSessionData) {
        console.log(previousSessionData);
        var resumelocation = parseInt(previousSessionData, 10);
        console.log("resuming from" + resumelocation + "location");
        // box.viewer.currentPageNumber = resumelocation;
        box.triggerSlideResumeDone();
    }, function() {
        console.log("failed to obtain resume data from server");
    });
};

box.SetViewedPagesFromServer = function(resumeDataPromise) {
    resumeDataPromise.then( function(previousSessionData) {
        console.log(previousSessionData);
        var previousSessionDataObject = JSON.parse(previousSessionData);
        if (previousSessionDataObject.pagesViewedHash) {
            box.viewedPages = previousSessionDataObject.pagesViewedHash;
        }
        if (previousSessionDataObject.numPagesViewed) {
            box.numPagesViewed = previousSessionDataObject.numPagesViewed;
        }
    }, function() {
        console.log("failed to obtain resume data from server");
    });
}

box.getDataFromAcapPlayer = function(){
    var eventObject = new Object();
    eventObject.Name = "CAPI_GET";
    eventObject.Data = {};
    eventObject.Data.ask = "resumeData";
    eventObject.Data.callback = box.ResumePlaybackCallbackFn;
    box.EventEmitter.customEventTrigger(eventObject);

    eventObject.Name = "CAPI_GET";
    eventObject.Data = {};
    eventObject.Data.ask = "viewedPages";
    eventObject.Data.callback = box.SetViewedPagesFromServer;
    box.EventEmitter.customEventTrigger(eventObject);
};

box.setDataToAcapPlayer = function(currentSessionData){
    var eventObject = new Object();
    eventObject.Name = "CAPI_SET_RESUMEDATA";
    eventObject.Data = {};
    eventObject.Data.ResumeData = currentSessionData;
    box.EventEmitter.customEventTrigger(eventObject);

    eventObject.Name = "CAPI_SET_MODULEDATA";
    eventObject.Data = {};
    eventObject.Data.pagesViewedHash = box.viewedPages;
    eventObject.Data.numPagesViewed = box.numPagesViewed;
    eventObject.Data.numPages = box.totalPages;
    box.EventEmitter.customEventTrigger(eventObject);
};

box.updateCompletionIfCriteriaMet = function (event) {
    switch(event.type) {
        case "pagefocus":
        case "ready":
        try {
            if(box.completionCriteria.criteria === "onLaunch"){
                box.triggerCompletionEvent();
            }
            if(box.completionCriteria.criteria === "onPercentageView") {
                if(box.completionCriteria.viewPercent && box.numPagesViewed) {
                    if(((box.numPagesViewed/box.totalPages) * 100) >= box.completionCriteria.viewPercent) {
                        box.triggerCompletionEvent();
                    }
                }
            }
        } catch (error) {
            console.log(error);
        }
        break;


    }
}

box.updateSuccessIfCriteriaMet = function (event) {
    switch(event.type) {
        case "pagefocus":
        case "ready":
            // as box viewer can be used in job aids as well where there is cc/sc criteria ensuring slide exit event is still called
            try {
                if(box.successCriteria.criteria === "onLaunch"){
                    box.triggerPassedEvent();
                }
                if(box.successCriteria.criteria === "onPercentageView") {
                    if(box.successCriteria.viewPercent && box.numPagesViewed) {
                        if(((box.numPagesViewed/box.totalPages) * 100) >= box.successCriteria.viewPercent) {
                            box.triggerPassedEvent();
                        }
                    }
                }
                box.triggerSlideExitEvent(event);
            } catch (error)  {
                box.triggerSlideExitEvent(event);
            }
            break;
    }
}


/*
* ACAPEventEmitterClass - event manager for Box.
*/


box.ACAPEventEmitterClass = function() {
        this.callbackFns = new Array();
        this.previousSuspendData = 0;

    };

box.ACAPEventEmitterClass.prototype.addEventListener = function(fn) {
    var index = this.callbackFns.indexOf(fn);
    if(index < 0)
        this.callbackFns.push(fn);
}

box.ACAPEventEmitterClass.prototype.removeEventListener = function(fn) {
    var index = this.callbackFns.indexOf(fn);
    if( index > -1){
        this.callbackFns.splice(index, 1);
    }

}

box.ACAPEventEmitterClass.prototype.trigger = function(event) {
    switch(event.type) {

        // map pageFocus to CAPI_SLIDEEXIT
        // add an additional Name property to the event object
        case "pagechange":
            event.Name = "CAPI_SLIDEEXIT";
            event.data = {};
            event.data.page = event.pageNumber;
            event.data.numPages = box.totalPages;
            try {
                box.updatePagesViewed(event);
                box.updateSuccessIfCriteriaMet(event);
                box.updateCompletionIfCriteriaMet(event);
                box.setDataToAcapPlayer(event.data.page);
            } catch (e) {
                for (var i = 0; i < this.callbackFns.length; i++) {
                    this.callbackFns[i](event);
                }
            }
            break;
        case "pageerror":
            event.Name = "CAPI_ERROR";
            break;
        case "zoom":
            event.Name = "CAPI_ZOOM";
            break;
    }

    for (var i = 0; i < this.callbackFns.length; i++) {
        this.callbackFns[i](event);
    }
}

box.ACAPEventEmitterClass.prototype.customEventTrigger = function(event) {
    for (var i = 0; i < this.callbackFns.length; i++) {
        this.callbackFns[i](event);
    }
}


box.triggerStartedEvent = function(event) {
    var eventObject = new Object();
    eventObject.Name = "CAPI_STARTED";
    box.EventEmitter = box.ACAPInterface.getEventEmitter();
    box.EventEmitter.customEventTrigger(eventObject);
}

box.triggerCompletionEvent = function(){
    var eventObject = new Object();
    eventObject.Name = "CAPI_COMPLETED";
    box.EventEmitter.customEventTrigger(eventObject);
};

box.triggerPassedEvent = function(){
    var eventObject = new Object();
    eventObject.Name = "CAPI_PASSED";
    box.EventEmitter.customEventTrigger(eventObject);
};

box.triggerSlideExitEvent = function(event){
    if (!event.data) {
      event.data = {};
      event.data.page = box.ACAPInterface.getCurrentPage();
      event.data.numPages = box.ACAPInterface.getDurationInPages();
    }
    event.Name = "CAPI_SLIDEEXIT";
    box.EventEmitter.customEventTrigger(event);
};

box.triggerSlideResumeDone = function(){
    var event = new Object();
    event.Name = "CAPI_SLIDERESUME";
    box.EventEmitter.customEventTrigger(event);
};

/*
* ACAPInterface - interface object provided to ACAP player to control the playback of the box.
*/

box.ACAPInterface = new (function(){

    /*private properties */

    var currentPage;
    var numOfPages;

    /* public getters and setters*/

    this.getCurrentPage = function () {
        return currentPage;
    },

    this.getDurationInPages = function () {
        return numOfPages;
    },

    this.setNumPagesFromEvent = function(event) {
      if(event && event.numPages) {
        numOfPages = event.numPages;
      }
    },

    this.updateCurrentPageFromEvent = function (event) {
        currentPage = event.currentPageNumber ? event.currentPageNumber: event.pageNumber;
    }

    /*public properties */
    this.seek =  function(pageNo) {
        if (pdfViewer !== null) {
            pdfViewer.currentPageNumber = pageNo;
        }
    },

    this.getEventEmitter = function(){
        if (!box.EventEmitter) {
            box.EventEmitter = new box.ACAPEventEmitterClass();
            container.addEventListener("pagechange", $.proxy(box.EventEmitter.trigger, box.EventEmitter));
            container.addEventListener("zoom", $.proxy(box.EventEmitter.trigger, box.EventEmitter));
        }
        return box.EventEmitter;
    }

    this.zoomIn = function() {
        // box.viewer.zoom(Crocodoc.ZOOM_IN);
        pdfViewer.currentScale = pdfViewer.currentScale + 0.1;
    },

    this.zoomOut = function() {
        // box.viewer.zoom(Crocodoc.ZOOM_OUT);
        if (pdfViewer.currentScale < 0.25) {
          return;
        }
        pdfViewer.currentScale = pdfViewer.currentScale - 0.1;
    },

    this.scrollToNext = function() {
        if (currentPage < numOfPages) {
          currentPage++;
          pdfViewer.currentPageNumber = currentPage;
        }
    },

    this.scrollToPrev = function() {
        if (currentPage > 1) {
          currentPage--;
          pdfViewer.currentPageNumber = currentPage;
        }
    },

    this.scrollTo = function(pageNo) {
        pdfViewer.currentPageNumber = pageNo;
    },

    this.setReportingOptions = function (successCriteria, completionCriteria) {
        box.completionCriteria = {};
        box.successCriteria = {};
        if(completionCriteria.CClaunchContent) {
            box.completionCriteria.criteria = "onLaunch";
        } else if(completionCriteria.CCslideViewPercent !== 0) {
            box.completionCriteria.criteria = "onPercentageView";
            box.completionCriteria.viewPercent = completionCriteria.CCslideViewPercent;
        }


        if(successCriteria.SClaunchContent) {
            box.successCriteria.criteria = "onLaunch";
        } else if(successCriteria.SCslideViewPercent !== 0) {
            box.successCriteria.criteria = "onPercentageView";
            box.successCriteria.viewPercent = successCriteria.SCslideViewPercent;
        }
    }

});