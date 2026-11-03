// Each child has a separate D1 binding; never fall back to the legacy shared DB.
export const accounts = {'马亦谦':'DB_MAYIQIAN','马熠初':'DB_MAYICHU'};
export function databaseForUser(env,user) {
    const binding=accounts[user];
    if(!binding)throw Error('请选择马亦谦或马熠初');
    if(!env[binding])throw Error('当前账号的独立数据库尚未配置');
    return env[binding];
}
