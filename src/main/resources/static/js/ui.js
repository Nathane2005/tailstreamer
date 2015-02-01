/**
 * UI module
 */
"use strict";

var $ = require('jquery');
var hotkeys = require('hotkeys');
require('qtip2');
var is = require('is_js');

var socket = require('./socket');

/** The maximum number of log entries to display before removing old entries. */
var MAX_LINES = 5000;

var NOTIFICATION_DURATION = 200;

/** The hotkey dispatcher */
var dispatcher;

function initTooltips() {
    $.fn.qtip.defaults.style.classes = "qtip-light";

    var hotkeyModifier = is.mac() ? "&#8984;" : "Alt";

    $("#clearButton").qtip({content: "Clear contents <span class=\"shortcut\">" + hotkeyModifier + "+C</span>"});
    $("#filterButton").qtip({content: "Configure filters"});
    $("#highlightButton").qtip({content: "Configure highlighting"});

    var $searchField = $("#searchText");
    $searchField.qtip({
        content: "Search <span class=\"shortcut\">" + hotkeyModifier + "+S</span>",
        position: {
            my: "top center",
            at: "bottom center",
            target: $searchField
        }
    });
}

function initButtons() {
    var jumpToBottomButton = $("#jumpToBottomButton");
    var $logContent = $("#logContent");

    jumpToBottomButton.click(function(e) {
        $logContent.scrollTop($logContent[0].scrollHeight);
    });

    $logContent.on("scroll", function(e) {
        if ($logContent.scrollTop() + $logContent.innerHeight() !== $logContent[0].scrollHeight) {
            jumpToBottomButton.fadeIn();
        } else {
            jumpToBottomButton.fadeOut();
        }
    });
}

/**
 * Recalculates the proper size of the log content area.
 */
function sizeLogContentArea() {
    $("#logContent").height($(window).height() - 112);
}

/**
 * Tries to connect.
 */
function retryConnection() {
    hideConnectionError();
    socket.connect();
}

/**
 * Hides the connection error box
 */
function hideConnectionError() {
    var $messageBox = $("#connectionMessage");
    $messageBox.animate({top: -$messageBox.outerHeight()}, NOTIFICATION_DURATION);
}

function bindEventListeners() {
    $(window).resize(sizeLogContentArea);
    $("#clearButton").click(clearLog);
    $("#searchText").on("keyup click", updateSearch);
    $("#reconnectLink").hide().click(retryConnection);
}

function bindHotkeys() {
    dispatcher = new hotkeys.Dispatcher();

    var searchHotkey = 'alt s';
    var clearHotkey = 'alt c';

    if (is.mac()) {
        searchHotkey = 'cmd s';
        clearHotkey = 'cmd c';
    }

    dispatcher.on(searchHotkey, function() {
        $('#searchText').focus();
    });

    dispatcher.on(clearHotkey, function() {
        $('#clearButton').click();
    });
}

/**
 * Updates the search results displayed in the log area.
 */
function updateSearch() {
    var searchText = $("#searchText").val();
    var $logContent = $("#logContent");
    $logContent.find(":not(:contains(" + searchText + "))").hide();
    $logContent.find(":contains(" + searchText + ")").show();
    $logContent.unhighlight();
    $logContent.highlight(searchText);
    $logContent.scrollTop($logContent[0].scrollHeight);
}

function clearLog() {
    $("#logContent").empty();
}

function addLogMessage(message) {
    var searchText = $("#searchText").val();
    var $logContent = $("#logContent");

    // If we're scrolled down all the way, then automatically scroll to the bottom after appending
    // the new log entry. If not, that means the user scrolled up, so in that case we won't autoscroll.
    var autoscroll = ($logContent.scrollTop() + $logContent.innerHeight()) === $logContent[0].scrollHeight;

    var lines = $logContent.children();
    if (lines.length > MAX_LINES) {
        var diff = lines.length - MAX_LINES;
        lines.slice(0, diff).remove();
    }

    var $contentDiv = $(document.createElement("div"));
    $contentDiv.html(message);

    if (searchText.length > 0) {
        // If this doesn't match the search text, hide it
        if (message.toUpperCase().indexOf(searchText.toUpperCase()) < 0) {
            $contentDiv.hide();
        } else {
            $contentDiv.highlight(searchText);
        }
    }

    $logContent.append($contentDiv);

    if (autoscroll) {
        $logContent.scrollTop($logContent[0].scrollHeight);
    }
    flashIndicator();
}

/**
 * Flashes the connection indicator to indicate data
 * was received.
 */
function flashIndicator() {
    var $indicator = $("#indicator");
    $indicator.fadeOut(100, function() {
        $indicator.fadeIn(100);
    });
}

/**
 * Updates the connection state indicator.
 * @param state the connection state
 */
function setConnectionState(state) {
    var connectionStatus = $("#connectionStatus");
    var icon = $("#connectionStatus i");
    var message = $("#connectionMessage");
    var reconnectLink = $("#reconnectLink");
    icon.removeClass();

    switch (state) {
        case socket.ConnectionState.DISCONNECTED:
            icon.addClass("fa fa-exclamation-triangle");
            message.html("Disconnected");
            reconnectLink.show();
            break;
        case socket.ConnectionState.FAILED:
            icon.addClass("fa fa-exclamation-triangle");
            message.html("Failed to connect");
            reconnectLink.show();
            break;
        case socket.ConnectionState.CONNECTING:
            icon.addClass("fa fa-refresh");
            message.html("Connecting");
            reconnectLink.hide();
            break;
        case socket.ConnectionState.CONNECTED:
            icon.addClass("fa fa-check-circle");
            message.html("Connected");
            reconnectLink.hide();
            break;
    }
}

$(document).ready(function() {
    sizeLogContentArea();
    initButtons();
    initTooltips();
    bindEventListeners();
    bindHotkeys();

    socket.onConnectionStateChange(setConnectionState);
    socket.onLogMessage(addLogMessage);
});

exports.setConnectionState = setConnectionState;