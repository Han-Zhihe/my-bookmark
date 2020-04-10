app.controller('weixinArticleCtr', ['$scope', '$state', '$sce', '$filter', '$window', '$timeout', '$document', 'pubSubService', 'dataService', function ($scope, $state, $sce, $filter, $window, $timeout, $document, pubSubService, dataService) {
  console.log("Hello weixinArticleCtr...");
  if (dataService.smallDevice()) {
    $window.location = "http://m.mybookmark.cn/#/tags";
    return;
  }

  $scope.hoverBookmark = null;
  $scope.bookmarks = []; // 书签数据
  $scope.bookmark = {};
  $scope.bookmarkNormalHover = false;
  $scope.bookmarkEditHover = false;

  const perPageItems = 40;
  $scope.totalPages = 0;
  $scope.currentPage = 1;
  $scope.channelId = 1;

  $scope.inputPage = '';
  $scope.loadBusy = false;
  $scope.curDay = 0;
  $scope.toastrId = 0;
  $scope.random = 0;
  $scope.channels = JSON.parse(`[{"id":1,"name":"热门", "clicked": true},{"id":2,"name":"搞笑"},{"id":3,"name":"养生堂"},{"id":4,"name":"私房话"},{"id":5,"name":"八卦精"},{"id":6,"name":"科技咖"},{"id":7,"name":"财经迷"},{"id":8,"name":"汽车控"},{"id":9,"name":"生活家"},{"id":10,"name":"时尚圈"},{"id":11,"name":"育儿"},{"id":12,"name":"旅游"},{"id":13,"name":"职场"},{"id":14,"name":"美食"},{"id":15,"name":"历史"},{"id":16,"name":"教育"},{"id":17,"name":"星座"},{"id":18,"name":"体育"},{"id":19,"name":"军事"},{"id":20,"name":"游戏"},{"id":21,"name":"萌宠"}]`);
  var timeagoInstance = timeago();

  get('user').then((user) => {
    pubSubService.publish('Common.menuActive', {
      login: true,
      index: dataService.LoginIndexHot
    });
  })

  $scope.jumpToUrl = async function (url) {
    $window.open(url, '_blank');
  }

  $scope.favoriteBookmark = async function (b) {
    var menusScope = $('div[ng-controller="menuCtr"]').scope();
    var login = (menusScope && menusScope.login) || false;
    if (!login) {
      $scope.toastrId = toastr.info('请先登录再收藏书签！', "提示");
      return;
    }

    let bookmark = {}
    bookmark.title = b.title;
    bookmark.url = b.url;

    let id = await post("bookmarkAdd", bookmark);
    bookmark = await get("bookmark", { id })
    pubSubService.publish('EditCtr.inserBookmarsSuccess', bookmark);
  }

  $scope.storeBookmark = async function (bookmark) {
    var menusScope = $('div[ng-controller="menuCtr"]').scope();
    var login = (menusScope && menusScope.login) || false;
    if (!login) {
      $scope.toastrId = toastr.info('请先登录再转存书签！', "提示");
    } else {
      var b = $.extend(true, {}, bookmark); // 利用jQuery执行深度拷贝
      b.tags = [{
        name: b.createdBy
      }]
      pubSubService.publish('TagCtr.storeBookmark', b);
    }
  }

  $scope.copy = async function (url) {
    dataService.clipboard(url);
  }

  $scope.detailBookmark = async function (b) {
    if (!b.content) {
      $scope.jumpToUrl(b.url);
      return;
    }
    $scope.bookmark = b;
    $('.js-weixin-content').modal({ blurring: true }).modal('setting', 'transition', dataService.animation()).modal('show')
    $timeout(function () {
      $('.js-main-content').animate({ scrollTop: 0 }, 100);
      $('.js-weixin-content').modal("refresh");
    }, 10)
  }

  $scope.close = async function () {
    $('.js-weixin-content').modal('setting', 'transition', dataService.animation()).modal('hide');
  }

  // 快捷键r随机推荐
  $document.bind("keydown", function (event) {
    $scope.$apply(function () {
      var key = event.key.toUpperCase();
      if ($scope.hoverBookmark && dataService.keyShortcuts()) {
        if (key == 'I') {
          $scope.detailBookmark($scope.hoverBookmark)
        } else if (key == 'C') {
          $scope.copy($scope.hoverBookmark.url)
        }
      }
    })
  });

  $scope.setHoverBookmark = async function (bookmark) {
    $scope.hoverBookmark = bookmark;
  }

  $scope.changeCurrentPage = async function (currentPage) {
    currentPage = parseInt(currentPage) || 0;
    console.log(currentPage);
    if (currentPage <= $scope.totalPages && currentPage >= 1) {
      $scope.getWeixinArticles($scope.channelId, currentPage);
      $scope.currentPage = currentPage;
    }
  }

  $scope.getWeixinArticles = async function (channelId, page) {
    var menusScope = $('div[ng-controller="menuCtr"]').scope();
    var login = (menusScope && menusScope.login) || false;
    var index = login ? dataService.LoginIndexHot : dataService.NotLoginIndexHot;
    pubSubService.publish('Common.menuActive', {
      login: login,
      index: index
    });
    $scope.bookmarks = []
    $scope.bookmark = {}
    $scope.loadBusy = true;
    $scope.channelId = channelId;
    $scope.currentPage = page;
    $scope.totalPages = 0;
    $.ajax({
      url: `https://api.jisuapi.com/weixinarticle/get?channelid=${channelId}&start=${(page - 1) * perPageItems}&num=${perPageItems}&appkey=e95887468ab87d69`,
      type: 'get',
      dataType: "jsonp",
      jsonp: "callback",
      success: function (body) {
        dealBody(body);
        getHotBookmarksbyAPI(page - 1);
      },
      error: function (json) {
        $scope.loadBusy = false;
        toastr.error('获取热门失败！失败原因：' + json.msg, "提示");
        getHotBookmarksbyAPI();
      }
    });
  }

  async function getHotBookmarksbyAPI(page) {
    let requireData = {
      userId: null,
      lastupdataTime: new Date().getTime(),
      pageNo: 1,
      pageSize: 1000,
      sort: 'desc',
      renderType: 0,
      date: dayjs(new Date().getTime() - page * 24 * 3600 * 1000).format("YYYY年M月D日"),
      idfa: "d4995f8a0c9b2ad9182369016e376278",
      os: "ios",
      osv: "9.3.5"
    }

    $.ajax({
      url: "https://api.shouqu.me/api_service/api/v1/daily/dailyMark",
      type: 'post',
      data: requireData,
      success: function (json) {
        $timeout(function () {
          $scope.loadBusy = false;
          var alterRex = "/mmbiz.qpic.cn|images.jianshu.io|zhimg.com/g";
          var defaultSnap = "./images/default.jpg"
          var defaultFavicon = "./images/default.ico"
          if (json.code == 200) {
            var bookmarkList = json.data.list;
            bookmarkList.forEach((bookmark) => {
              var b = {};
              b.title = bookmark.title;
              b.url = bookmark.url;
              b.faviconUrl = bookmark.sourceLogo || defaultFavicon;
              b.createdBy = bookmark.sourceName;
              b.snapUrl = defaultSnap;
              if (bookmark.imageList.length >= 1) {
                if (bookmark.imageList[0].url) {
                  b.snapUrl = (json.data.pageNo == 1 ? (bookmark.imageList[0].url.match(alterRex) != null ? defaultSnap : bookmark.imageList[0].url) : defaultSnap);
                } else {
                  for (var i = 0; i < bookmark.images.length; i++) {
                    if (bookmark.images[i]) {
                      b.snapUrl = bookmark.images[i];
                      break;
                    }
                  }
                }
              }
              b.favCount = bookmark.favCount;
              b.createdAt = $filter('date')(new Date(bookmark.createtime < bookmark.updatetime ? bookmark.createtime : bookmark.updatetime), "yyyy-MM-dd HH:mm:ss");
              b.lastClick = $filter('date')(new Date(bookmark.createtime > bookmark.updatetime ? bookmark.createtime : bookmark.updatetime), "yyyy-MM-dd HH:mm:ss");
              b.id = bookmark.articleId;
              b.index = $scope.bookmarks.length - 1;
              $scope.bookmarks.unshift(b);
            })
          }
        }, 10)
      },
      error: function (json) {
        $scope.loadBusy = false;
        toastr.error('获取热门书签失败！失败原因：' + json.message + "。将尝试从缓存中获取！", "提示");
      }
    });
  }

  function dealBody(body) {
    console.log('success............', body);
    $scope.loadBusy = false;
    $timeout(function () {
      var defaultSnap = "./images/default.jpg"
      var defaultFavicon = "./images/weixin.ico"
      if (body.status == 0) {
        var weixinArticles = body.result.list;
        var id = body.result.channelid;
        var total = body.result.total;
        $scope.totalPages = parseInt(total / perPageItems) + 1;
        $scope.channels.forEach((channel) => {
          if (channel.id === id) {
            channel.total = total;
          }
        })

        weixinArticles.forEach((articl, index) => {
          let cdate = new Date(articl.time).getTime() + (parseInt(Math.random() * 10000000000) % 36000)
          var b = {};
          b.index = index;
          b.title = articl.title;
          b.url = articl.url;
          b.faviconUrl = defaultFavicon;
          b.createdBy = articl.weixinname;
          b.account = articl.weixinaccount;
          b.snapUrl = articl.pic || defaultSnap;
          b.favCount = articl.likenum;
          b.createdAt = timeagoInstance.format(cdate, 'zh_CN');
          b.content = articl.content
          b.content = b.content.replace(/https:\/\/mmbiz.qpic.cn/gi, "http://img01.store.sogou.com/net/a/04/link?appid=100520029&url=https://mmbiz.qpic.cn")
          b.content = b.content.replace(/http:\/\/mmbiz.qpic.cn/gi, "http://img01.store.sogou.com/net/a/04/link?appid=100520029&url=https://mmbiz.qpic.cn")
          b.content = $sce.trustAsHtml(b.content);
          b.tags = [{
            id: -1,
            name: body.result.channel
          }];
          $scope.bookmarks.push(b);
        })
      } else {
        toastr.error('获取热门失败！失败原因：' + body.msg, "提示");
      }
    }, 10);
  }

  $scope.getWeixinArticles($scope.channelId, $scope.currentPage);
}]);
