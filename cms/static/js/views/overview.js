$(document).ready(function() {

    var droppableClasses = 'drop-target drop-target-prepend drop-target-before drop-target-after';

    /*
     * Determine information about where to drop the currently dragged
     * element. Returns the element to attach to and the method of
     * attachment ('before', 'after', or 'prepend').
     */
    var findDestination = function(ele) {
        var eleY = ele.offset().top;
        var containers = $(ele.data('droppable-class'));

        for(var i = 0; i < containers.length; i++) {
            var container = $(containers[i]);
            // Exclude the 'new unit' buttons, and make sure we don't
            // prepend an element to itself
            var siblings = container.children().filter(function () {
                return $(this).data('id') !== undefined && !$(this).is(ele);
            });
            // If the container is collapsed, check to see if the
            // element is on top of its parent list -- don't check the
            // position of the container
            var parentList = container.parents(ele.data('parent-location-selector')).first();
            if(parentList.hasClass('collapsed')) {
                if(Math.abs(eleY - parentList.offset().top) < 50) {
                    return {
                        ele: container,
                        attachMethod: 'prepend',
                        parentList: parentList
                    };
                }
            }
            // Otherwise, do check the container
            else {
                // If the list is empty, we should prepend to it,
                // unless both elements are at the same location --
                // this prevents the user from being unable to expand
                // a section
                var containerY = container.offset().top;
                if(siblings.length == 0 &&
                   containerY != eleY &&
                   Math.abs(eleY - containerY) < 50) {
                    return {
                        ele: container,
                        attachMethod: 'prepend'
                    };
                }
                // Otherwise the list is populated, and we should attach before/after a sibling
                else {
                    for(var j = 0; j < siblings.length; j++) {
                        var $sibling = $(siblings[j]);
                        var siblingY = $sibling.offset().top;
                        // Subtract 1 to be sure that we test if this
                        // element is actually on top of the sibling,
                        // rather than next to it. This prevents
                        // saving when expanding/collapsing a list.
                        if(Math.abs(eleY - siblingY) < $sibling.height() - 1) {
                            return {
                                ele: $sibling,
                                attachMethod: siblingY > eleY ? 'before' : 'after'
                            };
                        }
                    }
                }
            }
        }
        // Failed drag
        return {
            ele: null,
            attachMethod: ''
        };
    };

    // Information about the current drag.
    var dragState = {};

    var onDragStart = function(draggie, event, pointer) {
        var ele = $(draggie.element);
        dragState = {
            // Where we started, in case of a failed drag
            offset: ele.offset(),
            // Which element will be dropped into/onto on success
            dropDestination: null,
            // Timer if we're hovering over a collapsed section
            expandTimer: null,
            // The list which will be expanded on hover
            toExpand: null
        };
    };

    var onDragMove = function(draggie, event, pointer) {
        var ele = $(draggie.element);
        var destinationInfo = findDestination(ele);
        var destinationEle = destinationInfo.ele;
        var parentList = destinationInfo.parentList;
        // Clear the timer if we're not hovering over any element
        if(!parentList) {
            clearTimeout(dragState.expandTimer);
        }
        // If we're hovering over a new element, clear the timer and
        // set a new one
        else if(!dragState.toExpand || parentList[0] !== dragState.toExpand[0]) {
            clearTimeout(dragState.expandTimer);
            dragState.expandTimer = setTimeout(function() {
                parentList.removeClass('collapsed');
                parentList.find('.expand-collapse-icon').removeClass('expand').addClass('collapse');
            }, 400);
            dragState.toExpand = parentList;
        }
        // Clear out the old destination
        if(dragState.dropDestination) {
            dragState.dropDestination.removeClass(droppableClasses);
        }
        // Mark the new destination
        if(destinationEle) {
            destinationEle.addClass('drop-target drop-target-' + destinationInfo.attachMethod);
            dragState.dropDestination = destinationEle;
        }
    };

    var onDragEnd = function(draggie, event, pointer) {
        var ele = $(draggie.element);

        var destinationInfo = findDestination(ele);
        var destination = destinationInfo.ele;

        // If the drag succeeded, rearrange the DOM and send the result.
        if(destination && pointer.x >= ele.offset().left
           && pointer.x < ele.offset().left + ele.width()) {
            // Make sure we don't drop into a collapsed element
            if(destinationInfo.parentList) {
                destinationInfo.parentList.removeClass('collapsed');
            }
            var method = destinationInfo.attachMethod;
            destination[method](ele);
            handleReorder(ele);
        }

        // Everything in its right place
        ele.css({
            top: 'auto',
            left: 'auto'
        });

        // Clear dragging state in preparation for the next event.
        if(dragState.dropDestination) {
            dragState.dropDestination.removeClass(droppableClasses);
        }
        clearTimeout(dragState.expandTimer);
        dragState = {};
    };

    /*
     * Find all parent-child changes and save them.
     */
    var handleReorder = function(ele) {
        var parentSelector = ele.data('parent-location-selector');
        var childrenSelector = ele.data('child-selector');
        var newParentEle = ele.parents(parentSelector).first();
        var newParentID = newParentEle.data('id');
        var oldParentID = ele.data('parent-id');
        // If the parent has changed, update the children of the old parent.
        if(oldParentID !== newParentID) {
            // Find the old parent element.
            var oldParentEle = $(parentSelector).filter(function() {
                return $(this).data('id') === oldParentID;
            });
            saveItem(oldParentEle, childrenSelector, function() {
                ele.data('parent-id', newParentID);
            });
        }
        var saving = new CMS.Views.Notification.Mini({
            title: gettext('Saving&hellip;')
        });
        saving.show();
        saveItem(newParentEle, childrenSelector, function() {
            saving.hide();
        });
    };

    /*
     * Actually save the update to the server. Takes the element
     * representing the parent item to save, a CSS selector to find
     * its children, and a success callback.
     */
    var saveItem = function(ele, childrenSelector, success) {
        // Find all current child IDs.
        var children = _.map(
            ele.find(childrenSelector),
            function(child) {
                return $(child).data('id');
            }
        );
        $.ajax({
            url: '/save_item',
            type: 'POST',
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify({
                id: ele.data('id'),
                children: children
            }),
            success: success
        });
    };

    /*
     * Make `type` draggable using `handleClass`, able to be dropped
     * into `droppableClass`, and with parent type
     * `parentLocationSelector`.
     */
    var makeDraggable = function(type, handleClass, droppableClass, parentLocationSelector) {
        _.each(
            $(type),
            function(ele) {
                // Remember data necessary to reconstruct the parent-child relationships
                $(ele).data('droppable-class', droppableClass);
                $(ele).data('parent-location-selector', parentLocationSelector);
                $(ele).data('child-selector', type);
                var draggable = new Draggabilly(ele, {
                    handle: handleClass,
                    axis: 'y'
                });
                draggable.on('dragStart', onDragStart);
                draggable.on('dragMove', onDragMove);
                draggable.on('dragEnd', onDragEnd);
            }
        );
    };

    // Section
    makeDraggable(
        '.courseware-section',
        '.section-drag-handle',
        '.courseware-overview',
        'article.courseware-overview'
    );
    // Subsection
    makeDraggable(
        '.id-holder',
        '.subsection-drag-handle',
        '.subsection-list > ol',
        '.courseware-section'
    );
    // Unit
    makeDraggable(
        '.unit',
        '.unit-drag-handle',
        'ol.sortable-unit-list',
        'li.branch, article.subsection-body'
    );
});
