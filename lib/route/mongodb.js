/**
 * MongoDB模型路由注册
 * Created by yinfxs on 16-5-31.
 */

'use strict';

const _ = require('underscore');
const mongoose = require('mongoose');
const i18n = require('../utils/i18n');
const log = require('../utils/log')(module);

const app = {};

exports = module.exports = app;


/**
 * 转换结果为toObject格式
 * @param result
 */
function transformToObject(result) {
    if (!_.isArray(result)) return result.toObject();
    const rets = [];
    result.forEach(function (obj) {
        rets.push(obj.toObject());
    });
    return rets;
}


/**
 * 根据schema.paths生成默认的查询条件
 * @param paths
 * @param keyword 关键字
 */
function defaultFindCondition(paths, keyword) {
    const condition = [];
    Object.keys(paths).forEach(function (key) {
        if (paths[key].instance != 'String' || paths[key].options.ctrltype == 'password' || ['ts', 'dr', '__v', '_id'].indexOf(key) != -1)  return;
        const object = {};
        object[key] = new RegExp(keyword);
        condition.push(object);
    });
    return {$or: condition};
}
/**
 * 对引用字段进行populate处理
 * @param paths
 * @param query
 */
function population(paths, query) {
    Object.keys(paths).forEach(function (key) {
        if (['ref', 'refs'].indexOf(paths[key].options.ctrltype) == -1)  return;
        const select = _.values((paths[key].options.refOptions || {}));
        query.populate(key, select.join(' '), paths[key].options.ref);
    });
}

/**
 * 新增操作
 * @param object 查询信息
 * @param req 请求对象
 * @param res 响应对象
 */
app.create = function (object, req, res) {
    const Model = object.Model;
    const modelCode = object.modelCode;
    Model.create(req.body, function (err, result) {
        if (err) {
            log.error(i18n.value('log_create_object_error', [modelCode, JSON.stringify(err)]));
            return res.json({err: {message: i18n.value('res_create_object_error'), detail: err}});
        }
        return res.json(transformToObject(result));
    });
};

/**
 * 删除操作
 * @param object 查询信息
 * @param req 请求对象
 * @param res 响应对象
 */
app.delete = function (object, req, res) {
    const Model = object.Model;
    const modelCode = object.modelCode;
    Model.remove(req.body, function (err, result) {
        if (err) {
            log.error(i18n.value('log_delete_object_error', [modelCode, JSON.stringify(err)]));
            return res.json({err: {message: i18n.value('res_delete_object_error'), detail: err}});
        }
        return res.json(result);
    });
};

/**
 * 更新操作
 * @param object 查询信息
 * @param req 请求对象
 * @param res 响应对象
 */
app.update = function (object, req, res) {
    const Model = object.Model;
    const modelCode = object.modelCode;
    //TODO 过滤特殊字段，以防特殊字段被修改覆盖
    Model.update(req.body.cond, req.body.doc, function (err, result) {
        if (err) {
            log.error(i18n.value('log_update_object_error', [modelCode, JSON.stringify(err)]));
            return res.json({err: {message: i18n.value('res_update_object_error'), detail: err}});
        }
        return res.json(result);
    });
};
/**
 * 列表查询
 * @param object 查询信息
 * @param req 请求对象
 * @param res 响应对象
 */
app.list = function (object, req, res) {
    const Model = object.Model;
    const modelCode = object.modelCode;
    const keyword = req.query.keyword || '';
    const conditions = keyword ? defaultFindCondition(Model.schema.paths, keyword) : {};// _.omit(req.query, 'flag', 'page', 'size', 'sort');
    const query = Model.find(conditions);
    const flag = parseInt(req.query.flag) || 0;
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 20;
    const sort = req.query.sort;
    if (flag != 1) query.skip((page > 0 ? page - 1 : 0) * size).limit(size);
    population(Model.schema.paths, query);
    query.sort(sort).exec(function (err, result) {
        if (err) {
            log.error(i18n.value('log_read_object_error', [modelCode, JSON.stringify(err)]));
            return res.json({err: {message: i18n.value('res_read_object_error'), detail: err}});
        }
        Model.count(conditions, function (err, count) {
            if (err) {
                log.error(i18n.value('log_read_object_error', [modelCode, JSON.stringify(err)]));
                return res.json({err: {message: i18n.value('res_read_object_error'), detail: err}});
            }
            let data = {
                data: transformToObject(result),
                totalelements: count,
                flag: flag,
                sort: sort,
                keyword: keyword,
                start: 1,
                end: count
            };
            if (flag != 1) {
                data.page = page;
                data.size = size;
                data.totalpages = Math.ceil(count / size);
                data.start = page > data.totalpages ? 0 : ((page - 1) * size + 1);
                data.end = page > data.totalpages ? 0 : (data.start + size - 1);
                data.end = data.end > data.totalelements ? data.totalelements : data.end;
            }
            return res.json(data);
        });
    });
};

/**
 * 根据ID查询单个对象
 * @param object 查询信息
 * @param req 请求对象
 * @param res 响应对象
 */
app.one = function (object, req, res) {
    const Model = object.Model;
    const modelCode = object.modelCode;
    const id = req.params.id;
    if (!id) return res.json({error: i18n.value('query_param_error'), detail: i18n.value('not_specified_id')});
    const query = Model.findById(id);
    population(Model.schema.paths, query);
    query.exec(function (err, result) {
        if (err) {
            log.error(i18n.value('log_read_object_error', [modelCode, JSON.stringify(err)]));
            return res.json({err: {message: i18n.value('res_read_object_error'), detail: err}});
        }
        return res.json(transformToObject(result));
    });
};