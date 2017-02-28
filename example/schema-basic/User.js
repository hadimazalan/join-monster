import {
  GraphQLObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
  GraphQLInt,
  GraphQLBoolean
} from 'graphql'

import {
  globalIdField
} from 'graphql-relay'

import Comment from './Comment'
import Post from './Post'
import Person from './Person'
import { toBase64, q, bool } from '../shared'
import { sortBy } from 'lodash'

const { STRATEGY, DB } = process.env

const User = new GraphQLObjectType({
  description: 'a stem contract account',
  name: 'User',
  sqlTable: q('accounts', DB),
  uniqueKey: 'id',
  interfaces: [ Person ],
  fields: () => ({
    id: {
      type: GraphQLInt
    },
    email: {
      type: GraphQLString,
      sqlColumn: 'email_address'
    },
    idEncoded: {
      description: 'The ID base-64 encoded',
      type: GraphQLString,
      sqlColumn: 'id',
      resolve: user => toBase64(user.idEncoded)
    },
    globalId: {
      description: 'The global ID for the Relay spec',
      ...globalIdField('User'),
      sqlDeps: [ 'id' ]
    },
    fullName: {
      description: 'A user\'s first and last name',
      type: GraphQLString,
      sqlDeps: [ 'first_name', 'last_name' ],
      resolve: user => `${user.first_name} ${user.last_name}`
    },
    capitalizedLastName: {
      description: 'The last name WITH CAPS LOCK',
      type: GraphQLString,
      sqlExpr: (table, args, context) => `upper(${table}.${q('last_name', DB)})` // eslint-disable-line no-unused-vars
    },
    comments: {
      description: 'Comments the user has written on people\'s posts',
      type: new GraphQLList(new GraphQLNonNull(Comment)),
      args: {
        active: {
          description: 'Get only comments not archived',
          type: GraphQLBoolean
        }
      },
      ...[ 'batch', 'mix' ].includes(STRATEGY) ?
        { sqlBatch:
          { thisKey: 'author_id',
            parentKey: 'id' },
          where: (table, args) => args.active ? `${table}.${q('archived', DB)} = ${bool(false, DB)}` : null } :
        { sqlJoin: (userTable, commentTable, args) => `${commentTable}.${q('author_id', DB)} = ${userTable}.${q('id', DB)} ${args.active ? `AND ${commentTable}.${q('archived', DB)} = ${bool(false, DB)}` : ''}` },
      resolve: user => user.comments.sort((a, b) => a.id - b.id) 
    },
    posts: {
      description: 'A list of Posts the user has written',
      type: new GraphQLList(Post),
      args: {
        active: {
          description: 'Get only posts not archived',
          type: GraphQLBoolean
        }
      },
      where: (table, args) => args.active ? `${table}.${q('archived', DB)} = ${bool(false, DB)}` : null,
      ...STRATEGY === 'batch' ?
        { sqlBatch:
          { thisKey: 'author_id',
            parentKey: 'id' } } :
        { sqlJoin: (userTable, postTable) => `${postTable}.${q('author_id', DB)} = ${userTable}.${q('id', DB)}` },
      resolve: user => user.posts.sort((a, b) => a.id - b.id)
    },
    following: {
      description: 'Users that this user is following',
      type: new GraphQLList(User),
      junctionTable: q('relationships', DB),
      ...[ 'batch', 'mix' ].includes(STRATEGY) ?
        { junctionTableKey: [ 'follower_id', 'followee_id' ],
          junctionBatch:
            { thisKey: 'follower_id',
              parentKey: 'id',
              sqlJoin: (relationTable, followeeTable) => `${relationTable}.${q('followee_id', DB)} = ${followeeTable}.${q('id', DB)}` } } :
        { sqlJoins:
          [ (followerTable, relationTable) => `${followerTable}.${q('id', DB)} = ${relationTable}.${q('follower_id', DB)}`,
            (relationTable, followeeTable) => `${relationTable}.${q('followee_id', DB)} = ${followeeTable}.${q('id', DB)}` ] },
      resolve: user => sortBy(user.following, 'first_name') 
    },
    favNums: {
      type: new GraphQLList(GraphQLInt),
      resolve: () => [1, 2, 3]
    },
    numLegs: {
      description: 'How many legs this user has',
      type: GraphQLInt,
      sqlColumn: 'num_legs'
    },
    numFeet: {
      description: 'How many feet this user has',
      type: GraphQLInt,
      sqlDeps: [ 'num_legs' ],
      resolve: user => user.num_legs
    }
  })
})

export default User 
