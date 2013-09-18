require(["jquery", "gettext", "mustache", "js/views/feedback_prompt",
         "js/views/feedback_notification", "jquery.fileupload"],
        function($, gettext, Mustache, PromptView, NotificationView) {

$(document).ready(function() {
    $('.uploads .upload-button').bind('click', showUploadModal);
    $('.upload-modal .close-button').bind('click', hideModal);
    $('.upload-modal .choose-file-button').bind('click', showFileSelectionMenu);
    $('.remove-asset-button').bind('click', removeAsset);
});

function removeAsset(e){
    e.preventDefault();

    var that = this;
    var msg = new PromptView.Warning({
        title: gettext("Delete File Confirmation"),
        message: gettext("Are you sure you wish to delete this item. It cannot be reversed!\n\nAlso any content that links/refers to this item will no longer work (e.g. broken images and/or links)"),
        actions: {
            primary: {
                text: gettext("OK"),
                click: function(view) {
                    // call the back-end to actually remove the asset
                    var url = $('.asset-library').data('remove-asset-callback-url');
                    var row = $(that).closest('tr');
                    $.post(url,
                        { 'location': row.data('id') },
                        function() {
                            // show the post-commit confirmation
                            var deleted = new NotificationView.Confirmation({
                                title: gettext("Your file has been deleted."),
                                closeIcon: false,
                                maxShown: 2000
                            });
                            deleted.show();
                            row.remove();
                            analytics.track('Deleted Asset', {
                                'course': course_location_analytics,
                                'id': row.data('id')
                            });
                        }
                    );
                    view.hide();
                }
            },
            secondary: [{
                text: gettext("Cancel"),
                click: function(view) {
                    view.hide();
                }
            }]
        }
    });
    return msg.show();
}

function showUploadModal(e) {
    e.preventDefault();
    resetUploadModal();
    $modal = $('.upload-modal').show();
    $('.upload-modal .file-chooser').fileupload({
        dataType: 'json',
        type: 'POST',
        maxChunkSize: 100 * 1000 * 1000,      // 100 MB
        autoUpload: true,
        progressall: function(e, data) {
            var percentComplete = parseInt((100 * data.loaded) / data.total, 10);
            showUploadFeedback(e, percentComplete);
        },
        maxFileSize: 100 * 1000 * 1000,   // 100 MB
        maxNumberofFiles: 100,
        add: function(e, data) {
            data.process().done(function () {
                data.submit();
            });
        },
        done: function(e, data) {
            displayFinishedUpload(data.result);
        }

    });
    $('.file-input').bind('change.startUpload', startUpload);
    $(".modal-cover").show();
}

function hideModal(e) {
    if (e) {
        e.preventDefault();
    }
    var $modalCover = $(".modal-cover");
    // Unit editors do not want the modal cover to hide when users click outside
    // of the editor. Users must press Cancel or Save to exit the editor.
    // module_edit adds and removes the "is-fixed" class.
    if (!$modalCover.hasClass("is-fixed")) {
        $('.file-input').unbind('change.startUpload');
        $modal.hide();
        $modalCover.hide();
    }
}

function showFileSelectionMenu(e) {
    e.preventDefault();
    $('.file-input').click();
}

function startUpload(e) {
    var files = $('.file-input').get(0).files;
    if (files.length === 0)
        return;

    $('.upload-modal h1').html(gettext('Uploading…'));
    $('.upload-modal .file-name').html(files[0].name);
    $('.upload-modal .choose-file-button').hide();
    $('.upload-modal .progress-bar').removeClass('loaded').show();
}

function resetUploadBar() {
    var percentVal = '0%';
    $('.upload-modal .progress-fill').width(percentVal);
    $('.upload-modal .progress-fill').html(percentVal);
}

function resetUploadModal() {
    // Reset modal so it no longer displays information about previously
    // completed uploads.
    resetUploadBar();
    $('.upload-modal .file-name').html('');
    $('.upload-modal h1').html(gettext('Upload New File'));
    $('.upload-modal .choose-file-button').html(gettext('Choose File'));
    $('.upload-modal .embeddable-xml-input').val('');
    $('.upload-modal .embeddable').hide();
}

function showUploadFeedback(event, percentComplete) {
    var percentVal = percentComplete + '%';
    $('.upload-modal .progress-fill').width(percentVal);
    $('.upload-modal .progress-fill').html(percentVal);
}

function markAsLoaded() {
    $('.upload-modal .copy-button').css('display', 'inline-block');
    $('.upload-modal .progress-bar').addClass('loaded');
}

function displayFinishedUpload(resp) {
    if (resp.status == 200) {
        markAsLoaded();
    }

    $('.upload-modal .embeddable-xml-input').val(resp.portable_url);
    $('.upload-modal .embeddable').show();
    $('.upload-modal .file-name').hide();
    $('.upload-modal .progress-fill').html(resp.msg);
    $('.upload-modal .choose-file-button').html(gettext('Load Another File')).show();
    $('.upload-modal .progress-fill').width('100%');

    // see if this id already exists, if so, then user must have updated an existing piece of content
    $("tr[data-id='" + resp.url + "']").remove();

    var template = $('#new-asset-element').html();
    var html = Mustache.to_html(template, resp);
    $('table > tbody').prepend(html);

    // re-bind the listeners to delete it
    $('.remove-asset-button').bind('click', removeAsset);

    analytics.track('Uploaded a File', {
        'course': course_location_analytics,
        'asset_url': resp.url
    });
}

}); // end require()
