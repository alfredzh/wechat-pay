import axios from 'axios';
import md5 from 'md5';
import sha1 from 'sha1';
import _ from 'underscore';
import xml2js from 'xml2js';

export enum WechatPaymentMode {
  PRODUCTION,
  SANDBOX
}

export enum SignType {
  MD5 = "md5",
  SHA1 = "sha1"
}

enum ReturnCode {
  SUCCESS = "SUCCESS",
  FAIL = "FAIL"
}

const productionUrls = {
  UNIFIED_ORDER: "https://api.mch.weixin.qq.com/pay/unifiedorder",
  ORDER_QUERY: "https://api.mch.weixin.qq.com/pay/orderquery",
  REFUND: "https://api.mch.weixin.qq.com/secapi/pay/refund",
  REFUND_QUERY: "https://api.mch.weixin.qq.com/pay/refundquery",
  DOWNLOAD_BILL: "https://api.mch.weixin.qq.com/pay/downloadbill",
  SHORT_URL: "https://api.mch.weixin.qq.com/tools/shorturl",
  CLOSE_ORDER: "https://api.mch.weixin.qq.com/pay/closeorder",
  REDPACK_SEND: "https://api.mch.weixin.qq.com/mmpaymkttransfers/sendredpack",
  REDPACK_QUERY: "https://api.mch.weixin.qq.com/mmpaymkttransfers/gethbinfo",
  TRANSFERS:
    "https://api.mch.weixin.qq.com/mmpaymkttransfers/promotion/transfers",
  TRANSFERS_QUERY:
    "https://api.mch.weixin.qq.com/mmpaymkttransfers/gettransferinfo"
};

const sandboxUrls = {
  UNIFIED_ORDER: "https://api.mch.weixin.qq.com/sandbox/pay/unifiedorder",
  ORDER_QUERY: "https://api.mch.weixin.qq.com/sandbox/pay/orderquery",
  REFUND: "https://api.mch.weixin.qq.com/secapi/sandbox/pay/refund",
  REFUND_QUERY: "https://api.mch.weixin.qq.com/sandbox/pay/refundquery",
  DOWNLOAD_BILL: "https://api.mch.weixin.qq.com/sandbox/pay/downloadbill",
  SHORT_URL: "https://api.mch.weixin.qq.com/sandbox/tools/shorturl",
  CLOSE_ORDER: "https://api.mch.weixin.qq.com/sandbox/pay/closeorder",
  REDPACK_SEND:
    "https://api.mch.weixin.qq.com/sandbox/mmpaymkttransfers/sendredpack",
  REDPACK_QUERY:
    "https://api.mch.weixin.qq.com/sandbox/mmpaymkttransfers/gethbinfo",
  TRANSFERS:
    "https://api.mch.weixin.qq.com/sandbox/mmpaymkttransfers/promotion/transfers",
  TRANSFERS_QUERY:
    "https://api.mch.weixin.qq.com/sandbox/mmpaymkttransfers/gettransferinfo"
};

interface WechatApiUrls {
  UNIFIED_ORDER: string;
  ORDER_QUERY: string;
  REFUND: string;
  REFUND_QUERY: string;
  DOWNLOAD_BILL: string;
  SHORT_URL: string;
  CLOSE_ORDER: string;
  REDPACK_SEND: string;
  REDPACK_QUERY: string;
  TRANSFERS: string;
  TRANSFERS_QUERY: string;
}

interface Config {
  appId: string;
  partnerKey: string;
  mchId: string;
  subMchId: string;
  notifyUrl: string;
  passphrase: string;
  pfx: string;
  mode?: WechatPaymentMode;
}

export class WechatPayment {
  mode: WechatPaymentMode = WechatPaymentMode.PRODUCTION;
  appId: string;
  partnerKey: string;
  mchId: string;
  subMchId: string;
  notifyUrl: string;
  passphrase: string;
  pfx: string;
  urls: WechatApiUrls;
  constructor(config: Config) {
    this.initConfig(config);
    this.initUrl();
  }
  protected initUrl() {
    if (this.mode === WechatPaymentMode.SANDBOX) {
      return (this.urls = sandboxUrls);
    }
    this.urls = productionUrls;
  }
  protected initConfig(config: Config) {
    this.appId = config.appId;
    this.partnerKey = config.partnerKey;
    this.mchId = config.mchId;
    this.subMchId = config.subMchId;
    this.notifyUrl = config.notifyUrl;
    this.passphrase = config.passphrase || config.mchId;
    this.pfx = config.pfx;
    this.mode = config.mode || this.mode;
  }
  protected generateTimeStamp(): string {
    const timestamp = +new Date().valueOf() / 1000;
    return timestamp.toString();
  }
  protected generateNonceStr(length?: number): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const maxPos = chars.length;
    let noceStr = "";
    const nonceStrLength = length || 32;
    for (let i = 0; i < nonceStrLength; i++) {
      noceStr += chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return noceStr;
  }
  protected extendWithDefault(obj, keysNeedExtend) {
    var defaults = {
      appid: this.appId,
      mch_id: this.mchId,
      sub_mch_id: this.subMchId,
      nonce_str: this.generateNonceStr(),
      notify_url: this.notifyUrl,
      op_user_id: this.mchId,
      pfx: this.pfx
    };
    var extendObject = {};
    keysNeedExtend.forEach(function(k) {
      if (defaults[k]) {
        extendObject[k] = defaults[k];
      }
    });
    return _.extend(extendObject, obj);
  }
  protected signByType(type: SignType, text: string) {
    if (type === SignType.SHA1) {
      return sha1(text);
    }
    return md5(text);
  }
  protected getSign(pkg, signType?: SignType) {
    pkg = _.clone(pkg);
    delete pkg.sign;
    let currentSignType = signType || SignType.MD5;
    var string1 = this.toQueryString(pkg);
    var stringSignTemp = string1 + "&key=" + this.partnerKey;
    const signValue = this.signByType(
      currentSignType,
      stringSignTemp
    ).toUpperCase();
    return signValue;
  }
  protected toQueryString(object) {
    return Object.keys(object)
      .filter(function(key) {
        return object[key] !== undefined && object[key] !== "";
      })
      .sort()
      .map(function(key) {
        return key + "=" + object[key];
      })
      .join("&");
  }
  private async signedQuery(url, params, options, callback) {
    let required = options.required || [];

    if (url == this.urls.REDPACK_SEND) {
      params = this.extendWithDefault(params, ["mch_id", "nonce_str"]);
    } else if (url == this.urls.TRANSFERS) {
      params = this.extendWithDefault(params, ["nonce_str"]);
    } else {
      params = this.extendWithDefault(params, [
        "appid",
        "mch_id",
        "sub_mch_id",
        "nonce_str"
      ]);
    }
    params = _.extend(
      {
        sign: this.getSign(params)
      },
      params
    );

    if (params.long_url) {
      params.long_url = encodeURIComponent(params.long_url);
    }

    for (const key in params) {
      if (params[key] !== undefined && params[key] !== null) {
        params[key] = params[key].toString();
      }
    }

    var missing = [];
    required.forEach(function(key) {
      var alters = key.split("|");
      for (var i = alters.length - 1; i >= 0; i--) {
        if (params[alters[i]]) {
          return;
        }
      }
      missing.push(key);
    });

    if (missing.length) {
      return callback("missing params " + missing.join(","));
    }

    try {
      const result = await axios.get(url, this.buildXml(params));
      this.validate(result.data, callback);
    } catch (e) {
      if (e) {
        // TODO error handler
      }
    }
  }
  buildXml(obj) {
    var builder = new xml2js.Builder({
      allowSurrogateChars: true
    });
    var xml = builder.buildObject({
      xml: obj
    });
    return xml;
  }
  public unifiedOrder(params, callback) {
    let requiredData = [
      "body",
      "out_trade_no",
      "total_fee",
      "spbill_create_ip",
      "trade_type"
    ];
    if (params.trade_type == "JSAPI") {
      requiredData.push("openid|sub_openid");
    } else if (params.trade_type == "NATIVE") {
      requiredData.push("product_id");
    }
    params.notify_url = params.notify_url || this.notifyUrl;
    this.signedQuery(
      this.urls.UNIFIED_ORDER,
      params,
      {
        required: requiredData
      },
      callback
    );
  }
  public async getBrandWCPayRequestParams(order, callback) {
    var default_params = {
      appId: this.appId,
      timeStamp: this.generateTimeStamp(),
      nonceStr: this.generateNonceStr(),
      signType: "MD5"
    };

    order = this.extendWithDefault(order, ["notify_url"]);

    this.unifiedOrder(order, function(err, data) {
      if (err) {
        return callback(err);
      }

      var params = _.extend(default_params, {
        package: "prepay_id=" + data.prepay_id
      });

      params.paySign = this.getSign(params);

      if (order.trade_type == "NATIVE") {
        params.code_url = data.code_url;
      } else if (order.trade_type == "MWEB") {
        params.mweb_url = data.mweb_url;
      }

      params.timestamp = params.timeStamp;

      callback(null, params);
    });
  }
  public validate(xml, callback) {
    var self = this;
    xml2js.parseString(
      xml,
      {
        trim: true,
        explicitArray: false
      },
      function(err, json) {
        var error = null,
          data;
        if (err) {
          error = new Error();
          err.name = "XMLParseError";
          return callback(err, xml);
        }

        data = json ? json.xml : {};

        // TODO split service error and others
        if (data.return_code === ReturnCode.FAIL) {
          error = new Error(data.return_msg);
          error.name = "ProtocolError";
        } else if (data.result_code === ReturnCode.FAIL) {
          error = new Error(data.err_code);
          error.name = "BusinessError";
        } else if (data.appid && self.appId !== data.appid) {
          error = new Error();
          error.name = "InvalidAppId";
        } else if (data.mch_id && self.mchId !== data.mch_id) {
          error = new Error();
          error.name = "InvalidMchId";
        } else if (data.mchid && self.mchId !== data.mchid) {
          error = new Error();
          error.name = "InvalidMchId";
        } else if (self.subMchId && self.subMchId !== data.sub_mch_id) {
          error = new Error();
          error.name = "InvalidSubMchId";
        } else if (data.sign && self.getSign(data) !== data.sign) {
          error = new Error();
          error.name = "InvalidSignature";
        }

        callback(error, data);
      }
    );
  }
}

// var md5 = require('md5');
// var sha1 = require('sha1');
// var request = require('request');
// var _ = require('underscore');
// var xml2js = require('xml2js');
// var https = require('https');
// var url_mod = require('url');

// var signTypes = {
//   MD5: md5,
//   SHA1: sha1
// };

// var RETURN_CODES = {
//   SUCCESS: 'SUCCESS',
//   FAIL: 'FAIL'
// };

// var URLS = {
//   UNIFIED_ORDER: 'https://api.mch.weixin.qq.com/pay/unifiedorder',
//   ORDER_QUERY: 'https://api.mch.weixin.qq.com/pay/orderquery',
//   REFUND: 'https://api.mch.weixin.qq.com/secapi/pay/refund',
//   REFUND_QUERY: 'https://api.mch.weixin.qq.com/pay/refundquery',
//   DOWNLOAD_BILL: 'https://api.mch.weixin.qq.com/pay/downloadbill',
//   SHORT_URL: 'https://api.mch.weixin.qq.com/tools/shorturl',
//   CLOSE_ORDER: 'https://api.mch.weixin.qq.com/pay/closeorder',
//   REDPACK_SEND: 'https://api.mch.weixin.qq.com/mmpaymkttransfers/sendredpack',
//   REDPACK_QUERY: 'https://api.mch.weixin.qq.com/mmpaymkttransfers/gethbinfo',
//   TRANSFERS: 'https://api.mch.weixin.qq.com/mmpaymkttransfers/promotion/transfers',
//   TRANSFERS_QUERY: 'https://api.mch.weixin.qq.com/mmpaymkttransfers/gettransferinfo',
// };

// var Payment = function(config) {
//   this.appId = config.appId;
//   this.partnerKey = config.partnerKey;
//   this.mchId = config.mchId;
//   this.subMchId = config.subMchId;
//   this.notifyUrl = config.notifyUrl;
//   this.passphrase = config.passphrase || config.mchId;
//   this.pfx = config.pfx;
//   return this;
// };

// Payment.prototype.getBrandWCPayRequestParams = function(order, callback) {
//   var self = this;
//   var default_params = {
//     appId: this.appId,
//     timeStamp: this._generateTimeStamp(),
//     nonceStr: this._generateNonceStr(),
//     signType: 'MD5'
//   };

//   order = this._extendWithDefault(order, [
//     'notify_url'
//   ]);

//   this.unifiedOrder(order, function(err, data) {
//     if (err) {
//       return callback(err);
//     }

//     var params = _.extend(default_params, {
//       package: 'prepay_id=' + data.prepay_id
//     });

//     params.paySign = self._getSign(params);

//     if (order.trade_type == 'NATIVE') {
//       params.code_url = data.code_url;
//     }else if(order.trade_type == 'MWEB'){
//       params.mweb_url = data.mweb_url;
//     }

//     params.timestamp = params.timeStamp;

//     callback(null, params);
//   });
// };

// Payment.prototype.sendRedPacket = function(order, callback) {
//   var self = this;
//   var default_params = {
//     wxappid: this.appId
//   };

//   order = _.extend(order, default_params);

//   var requiredData = ['mch_billno', 'send_name', 're_openid', 'total_amount', 'total_num', 'wishing', 'client_ip', 'act_name', 'remark'];

//   this._signedQuery(URLS.REDPACK_SEND, order, {
//     https: true,
//     required: requiredData
//   }, callback);
// };

// Payment.prototype.redPacketQuery = function(order, callback) {
//   var self = this;
//   var default_params = {
//     bill_type: 'MCHT'
//   };

//   order = _.extend(order, default_params);

//   var requiredData = ['mch_billno'];

//   this._signedQuery(URLS.REDPACK_QUERY, order, {
//     https: true,
//     required: requiredData
//   }, callback);
// };

// Payment.prototype.transfers = function(order, callback) {
//   var self = this;
//   var default_params = {
//     mchid: this.mchId,
//     mch_appid: this.appId
//   };

//   order = _.extend(order, default_params);

//   var requiredData = ['mch_appid', 'partner_trade_no', 'openid', 'check_name', 'amount', 'desc', 'spbill_create_ip'];

//   this._signedQuery(URLS.TRANSFERS, order, {
//     https: true,
//     required: requiredData
//   }, callback);
// };

// Payment.prototype.transfersQuery = function(order, callback) {
//   var self = this;
//   var default_params = {
//     mch_id: this.mchId,
//     appid: this.appId
//   };

//   order = _.extend(order, default_params);

//   var requiredData = ['partner_trade_no'];

//   this._signedQuery(URLS.TRANSFERS_QUERY, order, {
//     https: true,
//     required: requiredData
//   }, callback);
// };

// /**
//  * Generate parameters for `WeixinJSBridge.invoke('editAddress', parameters)`.
//  *
//  * @param  {String}   data.url  Referer URL that call the API. *Note*: Must contain `code` and `state` in querystring.
//  * @param  {String}   data.accessToken
//  * @param  {Function} callback(err, params)
//  *
//  * @see https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=7_9
//  */
// Payment.prototype.getEditAddressParams = function(data, callback) {
//   if (!(data.url && data.accessToken)) {
//     var err = new Error('Missing url or accessToken');
//     return callback(err);
//   }

//   var params = {
//     appId: this.appId,
//     scope: 'jsapi_address',
//     signType: 'SHA1',
//     timeStamp: this._generateTimeStamp(),
//     nonceStr: this._generateNonceStr(),
//   };
//   var signParams = {
//     appid: params.appId,
//     url: data.url,
//     timestamp: params.timeStamp,
//     noncestr: params.nonceStr,
//     accesstoken: data.accessToken,
//   };
//   var string = this._toQueryString(signParams);
//   params.addrSign = signTypes[params.signType](string);
//   callback(null, params);
// };

// Payment.prototype._httpRequest = function(url, data, callback) {
//   request({
//     url: url,
//     method: 'POST',
//     body: data
//   }, function(err, response, body) {
//     if (err) {
//       return callback(err);
//     }

//     callback(null, body);
//   });
// };

// Payment.prototype._httpsRequest = function(url, data, callback) {
//   var parsed_url = url_mod.parse(url);
//   var req = https.request({
//     host: parsed_url.host,
//     port: 443,
//     path: parsed_url.path,
//     pfx: this.pfx,
//     passphrase: this.passphrase,
//     method: 'POST'
//   }, function(res) {
//     var content = '';
//     res.on('data', function(chunk) {
//       content += chunk;
//     });
//     res.on('end', function() {
//       callback(null, content);
//     });
//   });

//   req.on('error', function(e) {
//     callback(e);
//   });
//   req.write(data);
//   req.end();
// };

// Payment.prototype._signedQuery = function(url, params, options, callback) {
//   var self = this;
//   var required = options.required || [];

//   if (url == URLS.REDPACK_SEND) {
//     params = this._extendWithDefault(params, [
//       'mch_id',
//       'nonce_str'
//     ]);
//   } else if (url == URLS.TRANSFERS) {
//     params = this._extendWithDefault(params, [
//       'nonce_str'
//     ]);
//   } else {
//     params = this._extendWithDefault(params, [
//       'appid',
//       'mch_id',
//       'sub_mch_id',
//       'nonce_str'
//     ]);
//   }

//   params = _.extend({
//     'sign': this._getSign(params)
//   }, params);

//   if (params.long_url) {
//     params.long_url = encodeURIComponent(params.long_url);
//   }

//   for (var key in params) {
//     if (params[key] !== undefined && params[key] !== null) {
//       params[key] = params[key].toString();
//     }
//   }

//   var missing = [];
//   required.forEach(function(key) {
//     var alters = key.split('|');
//     for (var i = alters.length - 1; i >= 0; i--) {
//       if (params[alters[i]]) {
//         return;
//       }
//     }
//     missing.push(key);
//   });

//   if (missing.length) {
//     return callback('missing params ' + missing.join(','));
//   }

//   var request = (options.https ? this._httpsRequest : this._httpRequest).bind(this);
//   request(url, this.buildXml(params), function(err, body) {
//     if (err) {
//       return callback(err);
//     }
//     self.validate(body, callback);
//   });

// };

// Payment.prototype.unifiedOrder = function(params, callback) {
//   var requiredData = ['body', 'out_trade_no', 'total_fee', 'spbill_create_ip', 'trade_type'];
//   if (params.trade_type == 'JSAPI') {
//     requiredData.push('openid|sub_openid');
//   } else if (params.trade_type == 'NATIVE') {
//     requiredData.push('product_id');
//   }
//   params.notify_url = params.notify_url || this.notifyUrl;
//   this._signedQuery(URLS.UNIFIED_ORDER, params, {
//     required: requiredData
//   }, callback);
// };

// Payment.prototype.orderQuery = function(params, callback) {
//   this._signedQuery(URLS.ORDER_QUERY, params, {
//     required: ['transaction_id|out_trade_no']
//   }, callback);
// };

// Payment.prototype.refund = function(params, callback) {
//   params = this._extendWithDefault(params, [
//     'op_user_id'
//   ]);

//   this._signedQuery(URLS.REFUND, params, {
//     https: true,
//     required: ['transaction_id|out_trade_no', 'out_refund_no', 'total_fee', 'refund_fee']
//   }, callback);
// };

// Payment.prototype.refundQuery = function(params, callback) {
//   this._signedQuery(URLS.REFUND_QUERY, params, {
//     required: ['transaction_id|out_trade_no|out_refund_no|refund_id']
//   }, callback);
// };

// Payment.prototype.downloadBill = function(params, callback) {
//   var self = this;
//   this._signedQuery(URLS.DOWNLOAD_BILL, params, {
//     required: ['bill_date', 'bill_type']
//   }, function(err, rawData) {
//     if (err) {
//       if (err.name == 'XMLParseError') {
//         callback(null, self._parseCsv(rawData));
//       } else {
//         callback(err);
//       }
//     }
//   });
// };

// Payment.prototype.shortUrl = function(params, callback) {
//   this._signedQuery(URLS.SHORT_URL, params, {
//     required: ['long_url']
//   }, callback);
// };

// Payment.prototype.closeOrder = function(params, callback) {
//   this._signedQuery(URLS.CLOSE_ORDER, params, {
//     required: ['out_trade_no']
//   }, callback);
// };

// Payment.prototype._parseCsv = function(text) {
//   var rows = text.trim().split(/\r?\n/);

//   function toArr(rows) {
//     var titles = rows[0].split(',');
//     var bodys = rows.splice(1);
//     var data = [];

//     bodys.forEach(function(row) {
//       var rowData = {};
//       row.split(',').forEach(function(cell, i) {
//         rowData[titles[i]] = cell.split('`')[1];
//       });
//       data.push(rowData);
//     });
//     return data;
//   }

//   return {
//     list: toArr(rows.slice(0, rows.length - 2)),
//     stat: toArr(rows.slice(rows.length - 2, rows.length))[0]
//   };
// };

// Payment.prototype.buildXml = function(obj) {
//   var builder = new xml2js.Builder({
//     allowSurrogateChars: true
//   });
//   var xml = builder.buildObject({
//     xml: obj
//   });
//   return xml;
// };

// Payment.prototype.validate = function(xml, callback) {
//   var self = this;
//   xml2js.parseString(xml, {
//     trim: true,
//     explicitArray: false
//   }, function(err, json) {
//     var error = null,
//       data;
//     if (err) {
//       error = new Error();
//       err.name = 'XMLParseError';
//       return callback(err, xml);
//     }

//     data = json ? json.xml : {};

//     if (data.return_code == RETURN_CODES.FAIL) {
//       error = new Error(data.return_msg);
//       error.name = 'ProtocolError';
//     } else if (data.result_code == RETURN_CODES.FAIL) {
//       error = new Error(data.err_code);
//       error.name = 'BusinessError';
//     } else if (data.appid && self.appId !== data.appid) {
//       error = new Error();
//       error.name = 'InvalidAppId';
//     } else if (data.mch_id && self.mchId !== data.mch_id) {
//       error = new Error();
//       error.name = 'InvalidMchId';
//     } else if (data.mchid && self.mchId !== data.mchid) {
//       error = new Error();
//       error.name = 'InvalidMchId';
//     } else if (self.subMchId && self.subMchId !== data.sub_mch_id) {
//       error = new Error();
//       error.name = 'InvalidSubMchId';
//     } else if (data.sign && self._getSign(data) !== data.sign) {
//       error = new Error();
//       error.name = 'InvalidSignature';
//     }

//     callback(error, data);
//   });
// };

// exports.Payment = Payment;
