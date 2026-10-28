import {db} from '@tako/db'
import {sql} from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import {nanoid} from 'nanoid'
import {requireAuth} from '../../middleware/auth.js'
import {isAgencyUser} from '../agency-access.js'
import {SESSION_COOKIE,authCookieOptions,STAFF_SESSION_MAX_AGE} from '../cookies.js'
import {createMigrationAccess} from './core.js'
import {temporaryPassword} from './password.js'
import {allowedMigrationTenants} from './allowed-tenants.js'
let instance:ReturnType<typeof createMigrationAccess>|undefined
export function migrationAccess(){return instance??=createMigrationAccess({db,sql,bcrypt,randomPassword:temporaryPassword,isAgencyUser,requireAuth,cookieName:SESSION_COOKIE,cookieOptions:authCookieOptions,sessionMaxAge:STAFF_SESSION_MAX_AGE,nanoid,allowedTenants:allowedMigrationTenants})}
