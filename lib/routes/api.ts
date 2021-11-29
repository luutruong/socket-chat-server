import {Router} from 'express'
import ApiController from '../controllers/ApiController'

const router = Router()

router.get('/', ApiController.index)

router.post('/socket/events', ApiController.postEvents)

export default router
