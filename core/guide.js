/**
 * @license
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview SparqlBlocks user actions tracking.
 * @author miguel.ceriani@gmail.com (Miguel Ceriani)
 */
'use strict';

goog.provide('SparqlBlocks.Guide');

SparqlBlocks.Guide = (function() {

  var filteredEventManager_ = function(workspace) {
    var listeners_ = [];
    var eventQueue_ = [];

    var addChangeListener_ = function(func) {
      listeners_.push(func);
      return func;
    };

    var removeChangeListener_ = function(func) {
      var i = listeners_.indexOf(func);
      if (i != -1) {
        listeners_.splice(i, 1);
      }
    };

    var fireChangeListener_ = function(event) {
      for (var i = 0, func; func = listeners_[i]; i++) {
        func(event);
      }
    };

    var fireEventsIfNotDragging = function() {
      if (!Blockly.dragMode_) {
        while (eventQueue_.length) {
          fireChangeListener_(eventQueue_.shift());
        }
      }
    }

    workspace.addChangeListener( function(lastEvent) {
      if (lastEvent.type != Blockly.Events.MOVE
          || lastEvent.newParentId || lastEvent.oldParentId) {
            var toAdd = true;
            var eventsBetweenCreateAndDelete = [];
            for (var pastEventId = eventQueue_.length - 1; pastEventId >= 0; pastEventId--) {
              var pastEvent = eventQueue_[pastEventId];
              if (pastEvent.blockId == lastEvent.blockId) {
                if (lastEvent.type == Blockly.Events.MOVE) {
                    if (pastEvent.type == Blockly.Events.MOVE &&
                        lastEvent.oldParentId == pastEvent.newParentId &&
                        lastEvent.oldInputName == pastEvent.newInputName) {
                          pastEvent.newParentId = lastEvent.newParentId;
                          pastEvent.newInputName = lastEvent.newInputName;
                          if (!pastEvent.oldParentId && !pastEvent.newParentId) {
                            eventQueue_.splice(pastEventId, 1);
                          }
                          toAdd = false;
                    }
                    break;
                } else if (lastEvent.type == Blockly.Events.DELETE) {
                  if (pastEvent.type == Blockly.Events.CREATE) {
                    eventsBetweenCreateAndDelete.push(pastEventId);
                    for (var i = 0; i < eventsBetweenCreateAndDelete.length; i++) {
                      eventQueue_.splice(eventsBetweenCreateAndDelete[i] - i, 1);
                    }
                    toAdd = false;
                    break;
                  } else {
                    eventsBetweenCreateAndDelete.push(pastEventId);
                  }
                } else if (lastEvent.type == Blockly.Events.CHANGE) {
                  if (pastEvent.type == Blockly.Events.CHANGE &&
                      pastEvent.element == lastEvent.element &&
                      pastEvent.name == lastEvent.name &&
                      pastEvent.newValue == lastEvent.oldValue) {
                    pastEvent.newValue = lastEvent.newValue;
                    toAdd = false;
                    break;
                  }
                }
              }
            }
            if (toAdd) {
              eventQueue_.push(lastEvent);
            }
      }
      setTimeout(fireEventsIfNotDragging,100);
    });

    return {
      addChangeListener: addChangeListener_,
      removeChangeListener: removeChangeListener_
    };

  }

  var nonModalDefaultStyle = {
    "top": "inherit",
    "left": "inherit",
    "bottom": "inherit",
    'width': 'inherit',
    "right": "inherit"
  };
  var modalDefaultStyle = {
    'width': '75%',
    "bottom": "inherit",
    'left': '15%',
    'top': '5%'
  };


  var track_ = function(workspace, options) {

    options =
        _.extend(
            { startStateId: 0 },
            options );

    var eventManager = filteredEventManager_(workspace);

    var stateList = options.stateList;
    if (!stateList || !stateList.length) {
      console.err("Empty State List!");
      return;
    }

    var data = {};
    var stateId = options.startStateId - 1;

    var enterNewState = function() {
      stateId++;
      var currState = stateList[stateId];
      if (!currState) {
        return;
      }

      var dialogDiv = document.getElementById(currState.dialog);

      var toReplaceArray = dialogDiv.getElementsByClassName("blockly-readOnly");
      var j = 0;
      for (var i = 0; i < toReplaceArray.length; i++) {
        var toReplace = toReplaceArray[i];
        var content = toReplace.innerHTML;
        var zoom = toReplace.getAttribute("blockly-zoom");
        toReplace.innerHTML = "";
        var localWorkspace = Blockly.inject(
          toReplace,
          _.extend(
            {'readOnly': true},
            zoom ?
              { zoom:
                  { controls: false,
                    wheel: false,
                    startScale: zoom }
              } : {} ));

        Blockly.Xml.domToWorkspace(localWorkspace, Blockly.Xml.textToDom("<xml>" + content + "</xml>"));
      }

      BlocklyDialogs.showDialog(
        dialogDiv, currState.useFocus ? data.focus : null, false, currState.modal,
        _.extend(
          {},
          currState.modal ? modalDefaultStyle : nonModalDefaultStyle,
          currState.style ? currState.style : {}
        ),
        function() { setTimeout(enterNewState); });

      if (currState.stepWhen) {
        var listener = eventManager.addChangeListener(function(event) {
          if (currState.stepWhen(
                _.extend(
                  {
                    workspace: workspace,
                    block: Blockly.Block.getById(event.blockId)
                  },
                  event,
                  event.newParentId ? { newParent: Blockly.Block.getById(event.newParentId) } : {},
                  event.oldParentId ? { oldParent: Blockly.Block.getById(event.oldParentId) } : {}),
                data)) {
              setTimeout( function() {
                eventManager.removeChangeListener(listener);
                BlocklyDialogs.hideDialog();
              });
          }
        });
      }
    }

    enterNewState();
    return {
      getStateId: function() {
        return stateId;
      }
    };

  }

  return {
    track: track_
  }

})();
