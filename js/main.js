var gui = require('nw.gui');
var win = gui.Window.get();
var fs = require('fs');
var path = require('path');
var request = require('request');
var https = require('https');
var http = require('http');
var ffmpeg = require('fluent-ffmpeg');
var spawn = require('child_process').spawn;
var clipboard = gui.Clipboard.get();

//localize
var Localize = require('localize');
var myLocalize = new Localize('./translations/');

//engines
var dailymotion = require('dailymotion');
var youtube = require('yt-streamer');

//var player;
var exec_path=path.dirname(process.execPath);
var search_type = 'videos';
var selected_resolution='1080p';
var current_video = NaN;
var current_search = '';
var current_start_index = 1;
var current_prev_start_index = 1;
var current_page = 1;
var current_search_page=1;
var current_song_page = 1;
var load_first_song_next=false;
var load_first_song_prev=false;
var current_song = NaN;
var next_vid;
var prev_vid;
var isDownloading = false;
var valid_vid=0;
var search_filters='';
var search_order='relevance';
var current_download={};
var canceled = false;

// global var
var search_engine = '';


// settings
var confDir;
if (process.platform === 'win32') {
    confDir = process.env.APPDATA+'/ht5streamer';
} else {
    confDir = getUserHome()+'/.config/ht5streamer';
}
var settings = JSON.parse(fs.readFileSync(confDir+'/ht5conf.json', encoding="utf-8"));
var download_dir = settings.download_dir;
var selected_resolution = settings.resolution;
var locale = settings.locale;
myLocalize.setLocale(locale);

var htmlStr = '<div id="menu"> \
    <div id="engines" class="space"> \
        <label>'+myLocalize.translate("Engine:")+'</label> \
        <select id="engines_select"> \
            <option value = "youtube">Youtube</option> \
            <option value = "dailymotion">dailymotion</option> \
        </select> \
    </div> \
    <form id="video_search"> \
        <label class="space">'+myLocalize.translate("Search:")+'</label> \
        <input type="text" id="video_search_query" name="video_search_query" placeholder="'+myLocalize.translate("Enter your search...")+'" required /> \
        <input type="submit" value="'+myLocalize.translate("Send")+'" />  \
    </form> \
        <label>'+myLocalize.translate("Search type:")+'</label> \
        <select id="search_type_select"> \
            <option value = "videos">Videos</option> \
            <option value = "playlists">Playlists</option> \
        </select> \
        <label>'+myLocalize.translate("Order by:")+'</label> \
        <select id="orderby_select"> \
            <option value = "relevance">'+myLocalize.translate("Relevance")+'</option> \
            <option value = "published">'+myLocalize.translate("Published")+'</option> \
            <option value = "viewCount">'+myLocalize.translate("Views")+'</option> \
            <option value = "rating">'+myLocalize.translate("Rating")+'</option> \
        </select> \
        <label>'+myLocalize.translate("Filters:")+'</label> \
        <select id="search_filters"> \
            <option value = ""></option> \
            <option value = "hd">HD</option> \
            <option id="3dopt" value = "3d">3D</option> \
        </select> \
        <a id="config_btn" href="#" title="'+myLocalize.translate("Settings")+'"> \
            <img src="images/config.png" height="28" width="28" /> \
        </a> \
        <div> \
        <form id="donate" action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank"> \
            <input type="hidden" name="cmd" value="_s-xclick"> \
            <input type="hidden" name="encrypted" value="-----BEGIN PKCS7-----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-----END PKCS7----- "> \
            <input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_donate_SM.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!"> \
            <img alt="" border="0" src="https://www.paypalobjects.com/fr_FR/i/scr/pixel.gif" width="1" height="1"> \
        </form> \
        </div> \
</div> \
<div id="content"> \
    <div id="left"> \
        <div id="loading" style="display:None;"><img style="width:28px;height:28px;"src="images/spinner.gif" />'+myLocalize.translate(" Loading videos...")+'</div> \
         <div id="search"> \
            <a class="back" title="'+myLocalize.translate("Previous page")+'"><img id="next" src="images/back.png" /></a> \
            <a title="'+myLocalize.translate("Next page")+'" class="next"><img id="back" src="images/next.png" /></a> \
            <div id="search_results"></div> \
        </div> \
        <div id="items_container"></div> \
    </div> \
    <div id="right"> \
            <video width="100%" height="100%" src="t.mp4"></video> \
    </div> \
    <div id="custom-menu"> \
<ol> \
<li><a id="copy" href="#">'+myLocalize.translate("Copy")+'</a> </li> \
<!-- <li><a id="paste" href="#">Paste</a> </li> -->\
<!--<li class="list-devider"> \
<hr /> \
</li> \
<li><a href="#">Mark as unread</a> </li> -->\
</ol> \
</div> \
</div>';


$(document).ready(function(){
    $('#main').append(htmlStr);
    // start keyevent listener
    var fn = function(e){ onKeyPress(e); };
    document.addEventListener("keydown", fn, false );
    // remove listener if input focused
    $('#video_search_query').focusin(function() {
        document.removeEventListener("keydown",fn, false);
    });
    $('#video_search_query').focusout(function() {
        document.addEventListener("keydown", fn, false );
    });
    
    $('#resolutions_select').val(selected_resolution);
    $("select#engines_select option:selected").each(function () {
		search_engine = $(this).val();
    });
    
     var player = $('video').mediaelementplayer()[0].player;
     $('#video_search').bind('submit', function(e){
        e.preventDefault();
        query=$('#video_search_query').val();
        current_start_index = 1;
        current_prev_start_index = 1;
        current_search=query;
        startSearch(query);
    });
    // open in browser
    $(document).on('click','.open_in_browser',function(e) {
        e.preventDefault();
        gui.Shell.openExternal($(this).attr('href'));
    });
    // fullscreen signal and callback
    $(document).on('click','.mejs-fullscreen-button',function(e) {
        if (win.isFullscreen === true) {
            $('#mep_0').attr('style','height:calc(100% - 50px) !important');
        } else {
            $('#mep_0').attr('style', 'height: 100% !important');
        }
        win.toggleFullscreen();
    });
    // next signal and callback
    $(document).on('click','.mejs-next-btn',function(e) {
        e.preventDefault();
        playNextVideo(next_vid);
    });
    // previous signal and callback
    $(document).on('click','.mejs-back-btn',function(e) {
        e.preventDefault();
        playNextVideo(prev_vid);
    });
    // start video by clicking title
     $(document).on('click','.start_video',function(e) {
        e.preventDefault();
        try {
            $('#'+current_song).closest('.youtube_item').toggleClass('highlight','false');
        } catch(err) {
        }
        // save current song/page and search for back btn
        try {
            prev_vid = current_song;
        } catch(err) {
            console.log('no media loaded, can\'t save current song...');
        }
        current_song_page = current_page;
        current_song = $(this).parent().closest('.youtube_item').find('div')[5].id;
        $('#'+current_song).closest('.youtube_item').toggleClass('highlight','true');
        startVideo(current_song);
    });
    // load video signal and callback
    $(document).on('click','.video_link',function(e) {
        e.preventDefault();
        try {
            $('#'+current_song).closest('.youtube_item').toggleClass('highlight','false');
        } catch(err) {
            console.log(err);
        }
        current_song_page = current_page;
        current_song = $(this).parent().closest('.youtube_item').find('div')[5].id;
        $('#'+current_song).closest('.youtube_item').toggleClass('highlight','true');
        try {
            next_vid = $('#'+current_song).parent().parent().next().find('div')[5].id;
        } catch(err) {
            load_first_song_next=true;
        }
        $('video').trigger('loadPlayer',[$(this).attr('href'),next_vid]);
    });
    $('video').on('loadPlayer',function(e,link,next_vid){
        player.pause();
        player.setSrc(link);
        player.play();
        player.media.addEventListener('ended', function () {
            // if previous page ended while playing continue with the first video on the new page
            if ( load_first_song_next === true ) {
                //try to load a new page if available
                    try {
                        if ($('.next').is(":visible")){
                            $('.next').click();
                        } else {
                            console.log('No more videos to plays...');
                        }
                    } catch(err) {
                        console.log(err + " : can't play next video...");
                    }
            } else if ( load_first_song_prev === true ) {
                try {
                    if ($('.back').is(":visible")){
                        $('.back').click();
                    } else {
                        console.log('No more videos to plays...');
                    }
                } catch(err) {
                    console.log(err + " : can't play next video...");
                }
            } else  {
                playNextVideo(next_vid);
            }
        });
    });
    //load playlist
    $(document).on('click','.load_playlist',function(e) {
        var pid = $(this).attr('id');
        loadPlaylistSongs(pid);
    });
    // download file signal and callback
    $(document).on('click','.download_file',function(e) {
        e.preventDefault();
        var link = $(this).attr('href');
        var title= $(this).attr('alt');
        if (search_engine === 'dailymotion') {
			var req = request($(this).attr('href'), function (error, response, body) {
				if (!error) {
					link = response.request.href;
					downloadFile(link,title);
				} else {
					console.log('can\'t get dailymotion download link');
					return;
				}
			});
		} else {
			downloadFile(link,title);
		}
    });
    //cancel download
    $(document).on('click','.cancel',function(e) {
		canceled=true;
		current_download.abort();
	});
    //engine select
    $("select#engines_select").change(function () {
        $("select#engines_select option:selected").each(function () {
                search_engine = $(this).val();
                current_page=1;
                current_search_page=1;
                current_start_index=1;
                if (search_engine === 'dailymotion') {
                    $("#3dopt").hide();
                    var html = '<option value = "relevance">'+myLocalize.translate("Relevance")+'</option> \
                                <option value = "recent">'+myLocalize.translate("Published")+'</option> \
                                <option value = "visited">'+myLocalize.translate("Views")+'</option> \
                                <option value = "rated">'+myLocalize.translate("Rating")+'</option>';
                    $('#orderby_select').empty().append(html);
                } else {
                    $("#3dopt").show();
                    var html = '<option value = "relevance">'+myLocalize.translate("Relevance")+'</option> \
                                <option value = "published">'+myLocalize.translate("Published")+'</option> \
                                <option value = "viewCount">'+myLocalize.translate("Views")+'</option> \
                                <option value = "rating">'+myLocalize.translate("Rating")+'</option>';
                    $('#orderby_select').empty().append(html);
                }
        });
    });
    // search order
    $("select#orderby_select").change(function () {
        $("select#orderby_select option:selected").each(function () {
            search_order = $(this).val();
        });
    });
    //search filters
    $("select#search_filters").change(function () {
        $("select#search_filters option:selected").each(function () {
                search_filters = $(this).val();
        });
    });
    $("select#search_type_select").change(function () {
        $("select#search_type_select option:selected").each(function () {
                search_type = $(this).val();
        });
    });
    // pagination
    $('.back').click(function() {
        current_page-=1;
        startSearch(current_search);
    });
    $('.next').click(function() {
        current_page+=1;
        startSearch(current_search);
    });
    // convert to mp3
    $(document).on('click','.convert',function(e) {
        e.preventDefault();
        if ( process.platform === 'win32' ){
            convertTomp3Win($(this).attr('alt'));
        }else{
            convertTomp3($(this).attr('alt'));
        }
    });
    // hide progress
    $(document).on('click','.hide_bar',function(e) {
        e.preventDefault();
        $(this).closest('.progress').hide();
    });
    //settings
    $('#config_btn').click(function() {
        editSettings();
    });
    
    startSearch('wu tang clan');
});

function onKeyPress(key) {
    if (key.key === 'Esc') {
        if (win.isFullscreen === true) {
           $('#mep_0').attr('style','height:calc(100% - 50px) !important');
           win.toggleFullscreen();
        }
    } else if (key.key === 'f') {
      $('#fullscreen_btn').click();
    }
}

//search
function startSearch(query){
    $('#items_container').empty().hide();
    $('#pagination').hide();
    $('#search').hide();
    $('#loading').show();
    if (query !== current_search) {
        current_page =1;
        current_search_page=1;
        current_start_index=1;
    }
    current_search=query;
    if (search_engine === 'dailymotion') {
        if (search_type === 'videos') {
            dailymotion.searchVideos(query,current_page,search_filters,search_order,function(datas){ getVideosDetails(datas,'dailymotion',false); });
        } else {
            dailymotion.searchPlaylists(query,current_page,function(datas){ getPlaylistInfos(datas, 'dailymotion'); });
        }
    }
    else if (search_engine === 'youtube') {
        if (search_type === 'videos') {
            youtube.searchVideos(query,current_page,search_filters, search_order,function(datas){ getVideosDetails(datas,'youtube',false); });
        } else {
            youtube.searchPlaylists(query,current_page,function(datas){ getPlaylistInfos(datas, 'youtube'); });
        }
    }
    
}

function searchRelated(vid,page) {
    youtube.searchRelated(vid,page,search_filters,function(datas){ getVideosDetails(datas,'youtube',true,vid); });
}


function getVideosDetails(datas,engine,sublist,vid) {
    // show next or hide back button if necessary
    if (sublist === false) {
        if (current_page == 1){
            $('.back').css({'display':'None'});
            $('.next').css({'display':'block'});
        } else {
            $('.back').css({'display':'block'});
            $('.next').css({'display':'block'});
        }
    }
    //dailymotion
    if (engine === 'dailymotion') {
        var items = datas.list;
        var totalResults = datas.total;
        if (totalResults === 0) {
            if (sublist === false) {
                $('#search_results').html(myLocalize.translate("<p><strong>No videos</strong> found...</p>"));
                $('#search').show();
                $('#loading').hide();
                $('.next').css({'display':'None'});
                $('.back').css({'display':'None'});
                return;
            }
        }
        if ((datas.has_more === 'true') && (sublist === false)) {
            $('.next').css({'display':'None'});
        }
        // print total results
        if (sublist === false) {
            $('#search_results').html('<p><strong>'+totalResults+'</strong>'+myLocalize.translate("videos found, page")+' '+current_page+'</p>');
        }
        try {
            p = items.length;
        } catch(err) {
            if (sublist === false) {
                $('#search_results').html(myLocalize.translate("<p><strong>No videos</strong> found...</p>"));
                $('#search').show();
                $('#loading').hide();
                $('.next').css({'display':'None'});
                $('.back').css({'display':'None'});
                return;
            }
        }
        // load videos
        for(var i=0; i<items.length; i++) {
            dailymotion.getVideoInfos(items[i].id,i,items.length,function(datas) {fillPlaylist(datas,sublist)});
        }
    }
    // youtube
    else if (engine === 'youtube') {
        totalResults = datas.totalItems;
        if (totalResults === 0) {
            if (sublist === false) {
                $('#search_results').html(myLocalize.translate(myLocalize.translate("<p><strong>No videos</strong> found...</p>")));
                $('#search').show();
                $('#loading').hide();
                $('.next').css({'display':'None'});
                $('.back').css({'display':'None'});
                return;
            }
        }
        if (sublist === false) {
            $('#search_results').html('<p><strong>'+totalResults+'</strong> '+myLocalize.translate("videos found, page")+' '+current_page+'</p>');
        } else {
            var pages = totalResults / 10;
            try {
                var p = $('#loadmore_'+vid).attr('alt').split('::')[1];
                if (parseInt(p) === 0) {
                    var string = $('#sublist_'+vid).parent().parent().find('a').first().text();
                    $('#sublist_'+vid).parent().parent().find('a').first().html(string + ' ('+totalResults+' '+myLocalize.translate("Videos found")+')');
                }
            } catch(err) {
                console.log(err);
                return;
            }
            var page = parseInt(p) + 1;
            if (page < pages) {
                $('#loadmore_'+vid).attr('alt',''+totalResults+'::'+page+'::'+vid+'').show();
            } else {
                $('#loadmore_'+vid).hide();
            }
        }
        var items=datas.items;
        try {
            if ((items.length < 25) && (sublist === false)) {
                $('.next').css({'display':'None'});
            }
        } catch(err) {
            if (sublist === false) {
                $('#search_results').html(myLocalize.translate("<p><strong>No videos</strong> found...</p>"));
                $('#search').show();
                $('#loading').hide();
                $('.next').css({'display':'None'});
                $('.back').css({'display':'None'});
                return;
            }
        }
        // load videos
        for(var i=0; i<items.length; i++) {
            youtube.getVideoInfos('http://www.youtube.com/watch?v='+items[i].id,i,items.length,function(datas) {fillPlaylist(datas,sublist,vid)});
        }
    }
}

function getPlaylistInfos(datas, engine){
    if (current_page == 1){
        $('.back').css({'display':'None'});
        $('.next').css({'display':'block'});
    } else {
        $('.back').css({'display':'block'});
        $('.next').css({'display':'block'});
    }
    //dailymotion
    if (engine === 'dailymotion') {
        var items=datas.list;
        var totalResults = datas.total;
        if (totalResults === 0) {
            $('#search_results').html(myLocalize.translate("<p><strong>No playlist</strong> found...</p>"));
            $('#search').show();
            $('#loading').hide();
            $('.next').css({'display':'None'});
            $('.back').css({'display':'None'});
            return;
        }
        $('#search_results').html('<p><strong>'+totalResults+'</strong> '+myLocalize.translate("playlists found, page")+' '+current_search_page+'</p>');
        if (datas.has_more === 'true') {
            $('.next').css({'display':'None'});
        }
        try {
            for(var i=0; i<items.length; i++) {
                loadPlaylistItems(items[i], 'dailymotion');
            }
        } catch(err) {
            $('#search_results').html(myLocalize.translate("<p><strong>No playlist</strong> found...</p>"));
            $('#search').show();
            $('#loading').hide();
            $('.next').css({'display':'None'});
            $('.back').css({'display':'None'});
        }
    }
    // youtube
    else if (engine === 'youtube') {
        totalResults = datas.totalItems;
        if (totalResults === 0) {
            $('#search_results').html(myLocalize.translate("<p><strong>No playlist</strong> found...</p>"));
            $('#search').show();
            $('#loading').hide();
            return;
        }
        $('#search_results').html('<p><strong>'+totalResults+'</strong> '+myLocalize.translate("playlists found, page")+' '+current_page+'</p>');
        var items=datas.items;
        try {
            if (items.length < 25) {
                $('.next').css({'display':'None'});
            }
        } catch(err) {
            $('#search_results').html(myLocalize.translate("<p><strong>No playlist</strong> found...</p>"));
            $('#search').show();
            $('#loading').hide();
            $('.next').css({'display':'None'});
            $('.back').css({'display':'None'});
            return;
        }
        // load videos
        for(var i=0; i<items.length; i++) {
           loadPlaylistItems(items[i], 'youtube');
        }
    }
    $('#items_container').show();
    $('#pagination').show();
    $('#search').show();
    $('#loading').hide();
}

function loadPlaylistItems(item, engine) {
    if (engine === 'dailymotion') {
        var title = item.name;
        var thumb = item.thumbnail_medium_url;
        var pid = item.id;
        var length=item.videos_total;
        var author = item['owner.username'];
        var description = item.description;
    }
    else if ( engine === 'youtube') {
        var pid = item.id;
        var length = item.size;
        var author = item.author;
        var description = item.description;
        var thumb =  item.thumbnail.sqDefault;
        var title = item.title;
    }
    $('#items_container').append('<div class="youtube_item_playlist"><img src="'+thumb+'" style="float:left;width:120px;height:90px;"/><div class="left" style="width:238px;"><p><b>'+title+'</b></p><p><span><b>total videos:</b> '+length+'</span>      <span><b>      author:</b> '+author+'</span></p></div><div class="right"><a href="#" id="'+pid+'::'+length+'::'+engine+'" class="load_playlist"><img width="36" height ="36" src="images/play.png" /></a></div></div>');
}

function loadPlaylistSongs(pid){
    $('#items_container').empty().hide();
    $('#pagination').hide();
    $('#search').hide();
    $('#loading').show();
    var plid = pid.split('::')[0];
    var length = pid.split('::')[1];
    var engine = pid.split('::')[2]
    current_start_index = 1;
    current_prev_start_index = 1;
    current_search_page=1;
    if (engine === 'dailymotion'){
        dailymotion.loadSongs(plid,length,current_search_page, function(datas, length, pid, engine) { fillPlaylistFromPlaylist(datas, length, pid, engine); });
    }
    else if ( engine === 'youtube') {
        youtube.loadSongs(plid,length,current_start_index, function(datas, length, pid, engine) { fillPlaylistFromPlaylist(datas, length, pid, engine); });
    }
    $('.next .back').css({'display':'None'});
}

function fillPlaylistFromPlaylist(datas, length, pid, engine) {
    var sublist=false;
    $('.next').css({'display':'None'});
    $('.back').css({'display':'None'});
    if (engine === 'dailymotion') {
        var items=datas.list;
        for(var i=0; i<items.length; i++) {
            dailymotion.getVideoInfos(items[i].id,i,items.length,function(datas) {fillPlaylist(datas,false);});
        }
        if (datas.has_more === true) {
            current_search_page+=1;
            setTimeout(function(){dailymotion.loadSongs(pid,length,current_search_page, function(datas,length, pid, engine) { fillPlaylistFromPlaylist(datas, length, pid, engine); });}, 2000);
        } else {
            current_page = 1;
            current_search_page = 1;
        }
    }
    else if ( engine === 'youtube') {
        var items=datas.items;
        current_start_index+=25;
        valid_vid = $('.youtube_item').length
        if (sublist === false) {
            $('#search_results').html('<p><strong>'+valid_vid+'</strong>'+ myLocalize.translate("verified videos in this playlist")+'</p>');
        }
        try {
            for(var i=0; i<items.length; i++) {
                youtube.getVideoInfos('http://www.youtube.com/watch?v='+items[i].video.id,i,items.length,function(datas) {fillPlaylist(datas,false);});
            }
        } catch(err) {
            if (sublist === false) {
                $('#search_results').html('<p><strong>'+valid_vid+'</strong>'+ myLocalize.translate("verified videos in this playlist")+'</p>');
                return;
            }
        }
        if ( parseInt(current_start_index) < parseInt(length) ) {
            setTimeout(function(){youtube.loadSongs(pid,length,current_start_index, function(datas, length, pid, engine) { fillPlaylistFromPlaylist(datas, length, pid, engine); });}, 2000);
        } else {
            current_start_index=1;
            current_page=1;
        }
    }
}

function fillPlaylist(items,sublist,sublist_id) {
    for(var i=0; i<items.length; i++) {
        if (items.length === 1) {
			printVideoInfos(items[i], true, false);
			var pos = $('#items_container .youtube_item').first().position()['top'];
			$(window).scrollTop(pos);
		} else {
			printVideoInfos(items[i],false, sublist,sublist_id);
		}
    }
    $('#items_container').show();
    $('#pagination').show();
    $('#search').show();
    $('#loading').hide();
    if (search_type === 'playlists') {
        if (sublist === false) {
            var valid_vid = $('.youtube_item').length
            $('#search_results').html('<p><strong>'+valid_vid+'</strong>'+ myLocalize.translate("verified videos in this playlist")+'</p>');
        }
    }
    if (load_first_song_next == true || load_first_song_prev === true) {
        playNextVideo();
    }
}

function printVideoInfos(infos,solo,sublist,sublist_id){
    try{
        var title = infos.title.replace(/\"/g,'');
        var thumb = infos.thumb;
        var vid = infos.id;
        var seconds = secondstotime(parseInt(infos.duration));
        var views = infos.views;
        var author = infos.author;
        if (solo === true) {
			$('#items_container').prepend('<div class="youtube_item"><div class="left"><img src="'+thumb+'" class="video_thumbnail" /></div><div class="item_infos"><span class="video_length">'+seconds+'</span><div><p><a class="start_video"><b>'+title+'</b></a></p><div><span><b>'+myLocalize.translate("Posted by:")+'</b> '+author+  ' </span><span style="margin-left:10px;"><b>'+myLocalize.translate("Views:")+' </b> '+views+'</span></div></div><div id="progress_'+vid+'" class="progress" style="display:none;"><p><b>'+myLocalize.translate("Downloading")+' :</b> <strong>0%</strong></p><progress value="5" min="0" max="100">0%</progress><a href="#" style="display:none;" class="convert" alt="" title="'+myLocalize.translate("Convert to mp3")+'"><img src="images/video_convert.png"></a><a href="#" style="display:none;" class="cancel space" alt="" title="'+myLocalize.translate("Cancel")+'"><img src="images/close.png"></a><a href="#" style="display:none;" class="hide_bar" alt="" title="'+myLocalize.translate("Close")+'"><img src="images/close.png"></a></div><div id="youtube_entry_res_'+vid+'"></div></div></a><div class="toggle-control"><a href="#" class="toggle-control-link" alt="'+vid+'">+ '+myLocalize.translate("Open related videos")+'</a><div class="toggle-content" style="display:none;"><div id="sublist_'+vid+'"></div><button id="loadmore_'+vid+'" class="load_more" alt="0::0::'+vid+'" style="display:none">'+myLocalize.translate("Load more videos")+'</button></div></div></div>');
		} else {
            if (sublist === false) {
                $('#items_container').append('<div class="youtube_item"><div class="left"><img src="'+thumb+'" class="video_thumbnail" /></div><div class="item_infos"><span class="video_length">'+seconds+'</span><div><p><a class="start_video"><b>'+title+'</b></a></p><div><span><b>'+myLocalize.translate("Posted by:")+'</b> '+author+  ' </span><span style="margin-left:10px;"><b>'+myLocalize.translate("Views:")+' </b> '+views+'</span></div></div><div id="progress_'+vid+'" class="progress" style="display:none;"><p><b>'+myLocalize.translate("Downloading")+' :</b> <strong>0%</strong></p><progress value="5" min="0" max="100">0%</progress><a href="#" style="display:none;" class="convert" alt="" title="'+myLocalize.translate("Convert to mp3")+'"><img src="images/video_convert.png"></a><a href="#" style="display:none;" class="cancel space" alt="" title="'+myLocalize.translate("Cancel")+'"><img src="images/close.png"></a><a href="#" style="display:none;" class="hide_bar" alt="" title="'+myLocalize.translate("Close")+'"><img src="images/close.png"></a></div><div id="youtube_entry_res_'+vid+'"></div></div></a><div class="toggle-control"><a href="#" class="toggle-control-link" alt="'+vid+'">+ '+myLocalize.translate("Open related videos")+'</a><div class="toggle-content" style="display:none;"><div id="sublist_'+vid+'"></div><button id="loadmore_'+vid+'" class="load_more" alt="0::0::'+vid+'" style="display:none">'+myLocalize.translate("Load more videos")+'</button></div></div></div>');
            } else {
                $('#sublist_'+sublist_id).append('<div class="youtube_item"><div class="left"><img src="'+thumb+'" class="video_thumbnail" /></div><div class="item_infos"><span class="video_length">'+seconds+'</span><div><p><a class="start_video"><b>'+title+'</b></a></p><div><span><b>'+myLocalize.translate("Posted by:")+'</b> '+author+  ' </span><span style="margin-left:10px;"><b>'+myLocalize.translate("Views:")+' </b> '+views+'</span></div></div><div id="progress_'+vid+'" class="progress" style="display:none;"><p><b>'+myLocalize.translate("Downloading")+' :</b> <strong>0%</strong></p><progress value="5" min="0" max="100">0%</progress><a href="#" style="display:none;" class="convert" alt="" title="'+myLocalize.translate("Convert to mp3")+'"><img src="images/video_convert.png"></a><a href="#" style="display:none;" class="cancel space" alt="" title="'+myLocalize.translate("Cancel")+'"><img src="images/close.png"></a><a href="#" style="display:none;" class="hide_bar" alt="" title="'+myLocalize.translate("Close")+'"><img src="images/close.png"></a></div><div id="youtube_entry_res_'+vid+'"></div></div><div class="toggle-control"><a href="#" class="toggle-control-link" alt="'+vid+'">+ '+myLocalize.translate("Open related videos")+'</a><div class="toggle-content" style="display:none;"><div id="sublist_'+vid+'"></div><button id="loadmore_'+vid+'" class="load_more" alt="0::0::'+vid+'" style="display:none">'+myLocalize.translate("Load more videos")+'</button></div></div></div>');
            }
        }
        var resolutions_string = ['1080p','720p','480p','360p'];
        var resolutions = infos.resolutions;
        for(var i=0; i<resolutions_string.length; i++) {
            try {
                var resolution = resolutions_string[i];
                var vlink = resolutions[resolution]['link'];
                if (vlink === 'null') { continue; }
                var container = resolutions[resolution]['container'];
            } catch(err) {
                continue;
            }
            var img='';
            if (resolution == "720p" || resolution == "1080p") {
                img='images/hd.png';
            } else {
                img='images/sd.png';
            }
            $('#youtube_entry_res_'+vid).append('<div class="resolutions_container"><a class="video_link" style="display:none;" href="'+vlink+'" alt="'+resolution+'"><img src="'+img+'" class="resolution_img" /><span>'+ resolution+'</span></a><a href="'+vlink+'" alt="'+title+'.'+container+'::'+vid+'" title="'+ myLocalize.translate("Download")+'" class="download_file"><img src="images/down_arrow.png" width="16" height="16" />'+resolution+'</a></div>');
        }
        if ($('#youtube_entry_res_'+vid+' a.video_link').length === 0){
            $('#youtube_entry_res_'+vid).parent().parent().remove();
        }
        if (search_engine === 'youtube') {
            $('#youtube_entry_res_'+vid).append('<a class="open_in_browser" title="'+ myLocalize.translate("Open in youtube")+'" href="http://www.youtube.com/watch?v='+vid+'"><img style="margin-top:8px;" src="images/export.png" />');
        } else if (search_engine === 'dailymotion') {
            $('#youtube_entry_res_'+vid).append('<a class="open_in_browser" title="'+ myLocalize.translate("Open in dailymotion")+'" href="http://www.dailymotion.com/video/'+vid+'"><img style="margin-top:8px;" src="images/export.png" /></a>');
            $('.toggle-control').css({'display':'none'});
        }
    } catch(err){
        console.log('printVideoInfos err: '+err);
    }
}

//playlist
function playNextVideo(vid_id) {
    try {
        var elem_id = '';
        // if page was changed
        if (current_song_page !== current_page){
            // if some items are loaded
            if ($('#items_container').children().length > 1){
                // play first item
                vid_id = $('#items_container').find('.youtube_item').find('div')[5].id;
            } else {
                return;
            } 
        }
        load_first_song_next=false;
        load_first_song_prev=false;
        current_song_page = current_page;
        startVideo(vid_id);
    } catch(err) {
        console.log(err + " : can't play next video...");
    }
}

function startVideo(vid_id) {
    var childs = $('#'+vid_id+' a.video_link');
    var elength = parseInt(childs.length);
    if (elength > 1){
        for(var i=0; i<elength; i++) {
            var found = false;
            var res = $(childs[i],this).attr('alt');
            if ( res == selected_resolution ){
                childs[i].click();
                break;
            } else {
                // if not found  select the highest resolution available...
                if ( i+1 == elength){
                    if (found === false){
                        childs[0].click();
                    } else {
                        continue;
                    }
                }
            }
        }
    } else {
        childs[0].click();
    }
}

//download and convert

function downloadFile(link,title){
    var vid = title.split('::')[1];
    var pbar = $('#progress_'+vid);
    var title = title.split('::')[0];
    if ( isDownloading === true ){
         pbar.show();
         $('#progress_'+vid+' strong').html(myLocalize.translate('A download is already running, please wait...'));
         setTimeout(function(){pbar.hide()},5000);
         return;
    }
    // remove file if already exist
    fs.unlink(download_dir+'/'+title, function (err) {
        if (err) {
        } else {
            console.log('successfully deleted '+download_dir+'/'+title);
        }
    });
    // start download
    pbar.show();
    canceled=false;
    $('#progress_'+vid+' strong').html(myLocalize.translate('Waiting for connection...'));
    isDownloading = true;
    var opt = {};
    var val = $('#progress_'+vid+' progress').attr('value');
    opt.link = link;
    opt.title = title;
    opt.vid = vid;
    var currentTime;
    var startTime = (new Date()).getTime();
    var target = download_dir+'/ht5_download.'+startTime;
    
	current_download = http.request(link,
		function (response) {
			$('#progress_'+vid+' a.cancel').show();
			var contentLength = response.headers["content-length"];
			var file = fs.createWriteStream(target);
			response.on('data',function (chunk) {
				file.write(chunk);
				var bytesDone = file.bytesWritten;
				currentTime = (new Date()).getTime();
				var transfer_speed = (bytesDone / ( currentTime - startTime)).toFixed(2);
				var newVal= bytesDone*100/contentLength;
				var txt = Math.floor(newVal)+'% '+ myLocalize.translate('done at')+' '+transfer_speed+' kb/s';
				$('#progress_'+vid+' progress').attr('value',newVal).text(txt);
				$('#progress_'+vid+' strong').html(txt);
			});
			response.on('end', function() {
				file.end();
				isDownloading = false;
				if (canceled === true) {
					fs.unlink(target, function (err) {
						if (err) {
						} else {
							console.log('successfully deleted '+target);
						}
					});
					$('#progress_'+vid+' a.cancel').hide();
					$('#progress_'+vid+' strong').html(myLocalize.translate("Download canceled!"));
					setTimeout(function(){pbar.hide()},5000);
				} else {
					fs.rename(target,download_dir+'/'+title, function (err) {
						if (err) {
						} else {
							console.log('successfully renamed '+download_dir+'/'+title);
						}
					});
					$('#progress_'+vid+' strong').html(myLocalize.translate('Download ended !'));
					$('#progress_'+vid+' a.convert').attr('alt',download_dir+'/'+title+'::'+vid).show();
					$('#progress_'+vid+' a.hide_bar').show();
					$('#progress_'+vid+' a.cancel').hide();
				}
			});
		});
		current_download.end();
}

function convertTomp3Win(file){
	var vid = file.split('::')[1];
    var title = file.split('::')[0];
    var pbar = $('#progress_'+vid);
    var target=title.substring(0, title.lastIndexOf('.'))+'.mp3';
    $('#progress_'+vid+' strong').html(myLocalize.translate("Converting video to mp3, please wait..."));
	var args = ['-i', title, '-ab', '192k', target];
    var ffmpeg = spawn(exec_path+'/ffmpeg.exe', args);
    console.log('Spawning ffmpeg ' + args.join(' '));
    ffmpeg.on('exit', function(){
		console.log('ffmpeg exited');
		$('#progress_'+vid+' strong').html(myLocalize.translate("video converted successfully !"));
		setTimeout(function(){pbar.hide()},5000);
	});
    ffmpeg.stderr.on('data', function(data) {
        console.log('grep stderr: ' + data);
    });
}

function convertTomp3(file) {
    try{
        var vid = file.split('::')[1];
        var title = file.split('::')[0];
        var pbar = $('#progress_'+vid);
        var target=title.substring(0, title.lastIndexOf('.'))+'.mp3';
        $('#progress_'+vid+' strong').html(myLocalize.translate("Converting video to mp3, please wait..."));
        var proc = new ffmpeg({ source: title })
          .withAudioBitrate('192k')
          .withAudioCodec('libmp3lame')
          .withAudioChannels(2)
          .toFormat('mp3')
          .saveToFile(target, function(stdout, stderr) {
            $('#progress_'+vid+' strong').html(myLocalize.translate("video converted successfully !"));
            fs.rename(target.replace(/ /,'\\ '),target, function (err) {
                if (err) {
                    console.log(err);
                } else {
                    console.log('successfully renamed '+getUserHome()+'/'+title);
                }
            });
            setTimeout(function(){pbar.hide()},5000);
        });
    } catch(err) {
        console.log('can\'t convert you video '+title+' to mp3...')
    }
}


// functions

function secondstotime(secs)
{
    var t = new Date(1970,0,1);
    t.setSeconds(secs);
    var s = t.toTimeString().substr(0,8);
    if(secs > 86399)
    	s = Math.floor((t - Date.parse("1/1/70")) / 3600000) + s.substr(2);
    return s;
}

function getUserHome() {
  return process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
}

function saveConfig(old_locale) {
    settings = JSON.parse(fs.readFileSync(confDir+'/ht5conf.json', encoding="utf-8"));
    settings.edit=false;
    fs.writeFile(confDir+'/ht5conf.json', JSON.stringify(settings), function(err) {
        if(err) {
            console.log(err);
	    return;
        } else {
            if ( old_locale !== settings.locale) {
                win.reload();
            } else {
                download_dir = settings.download_dir;
                selected_resolution = settings.resolution;
            }
        }
    });
}

function editSettings() {
    var old_locale=settings.locale;
    settings.edit=true;
    fs.writeFile(confDir+'/ht5conf.json', JSON.stringify(settings), function(err) {
        if(err) {
            console.log(err);
        } else {
            var new_win = gui.Window.open('config.html', {
              "position": 'center',
              "width": 640,
              "height": 250,
              "toolbar": false
            });
            new_win.on('close', function() {
              saveConfig(old_locale);
              this.hide();
              this.close(true);
            });
        }
    });
}
