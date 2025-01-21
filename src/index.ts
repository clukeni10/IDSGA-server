import express, { Request, Response } from 'express';
import { DataTypes, Model, Sequelize } from 'sequelize'
import dotenv from 'dotenv';
import multer from "multer"
import fs from "fs"
import { PersonType } from './types/PersonType';
import { CardType } from './types/CardType';
import path from 'path';

dotenv.config();

const port = process.env.PORT || 3000;
const app = express();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/';
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

app.use(express.json({ limit: '50mb' }));

app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

/* app.use('/uploads', (req, res, next) => {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
    if (allowedExtensions.includes(path.extname(req.url).toLowerCase())) {
        express.static(path.join(__dirname, 'uploads'))(req, res, next);
    } else {
        res.status(403).send('Acesso negado.');
    }
}); */


const sequelize = new Sequelize('sga_cards', 'root', 'sga-card', {
    host: 'localhost',
    dialect: 'mysql'
});

try {
    sequelize.authenticate();
    console.log('Connection has been established successfully.');
} catch (error) {
    console.error('Unable to connect to the database:', error);
}

const Escorts = sequelize.define('escorts', {
        personEscort: {
            type: DataTypes.STRING
        }
    }
);

const Functions = sequelize.define('functions', {
        personFunction: {
            type: DataTypes.STRING
        }
    }
);

const Card = sequelize.define('cards', {
        expiration: {
            type: DataTypes.DATE
        },
        cardNumber: {
            type: DataTypes.STRING,
            allowNull: false,
        }
    }
);

const Person = sequelize.define('persons', {
        name: {
            type: DataTypes.STRING
        },
        job: {
            type: DataTypes.STRING
        },
        escort: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        image: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }
);

const Entity = sequelize.define('entities', {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        }
    }
);

const Permission = sequelize.define('permissions', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    permission: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    }
});

Entity.sync()
Person.sync()
Card.sync()
Permission.sync()
Functions.sync()
Escorts.sync()

Person.belongsTo(Entity, {
    foreignKey: {
        name: 'entityId',
        allowNull: false,
    },
    as: 'entity'
});

Card.belongsTo(Person, {
    foreignKey: {
        name: 'personId',
        allowNull: false,
    },
    as: 'person'
});

const PersonPermissions = sequelize.define('person_permissions', {}, { timestamps: false });
Person.belongsToMany(Permission, { through: PersonPermissions });
Permission.belongsToMany(Person, { through: PersonPermissions });


/* (async () => {
    await sequelize.sync({ force: true }); 

    // Inserir permissões
    const permissions = ['A', 'B', 'C', 'D', 'E', 'F'].map(permission => ({ permission }));
    await Permission.bulkCreate(permissions);
    await PersonPermissions.sync({ force: true });

    console.log("Tabela 'permissions' populada com sucesso!");
})(); */

app.post('/card/save', upload.single('image'), async (req: Request<{}, {}, PersonType & CardType>, res: Response) => {
    try {
        const body = req.body
        const imagePath = req.file ? req.file.path : null;
        const entity = await Entity.findOne<Model<{ name: string, id: number }>>({where: { name: body.entity }});
        const data = entity?.dataValues;

        const person = await Person.create({ 
            name: body.name, 
            job: body.job, 
            escort: body.escort, 
            entityId: data?.id,
            image: imagePath
        })

        const accessType = JSON.parse(body.accessType as unknown as string);

        const permissions = await Permission.findAll({
            where: { permission: accessType }
        });
    
        await (person as any).addPermissions(permissions);
    
        await Card.create({ expiration: new Date(body.expiration), cardNumber: body.cardNumber, personId: person.dataValues.id });

        res.status(200).json({ success: true })
    } catch (error) {
        console.log(error)
        res.status(501).send(error)
    }
});

app.put('/card/save', upload.single('image'), async (req: Request<{}, {}, PersonType & CardType>, res: Response) => {
    try {
        const body = req.body;
        const imagePath = req.file ? req.file.path : null;

        console.log('imagePath', imagePath, body.personId, body);

        if (!body.personId) {
            res.status(400).json({ success: false, message: "Person ID is required for update" });
            return
        }

        const entity = await Entity.findOne<Model<{ name: string, id: number }>>({ where: { name: body.entity } });
        const data = entity?.dataValues;

        const person = await Person.findByPk(body.personId);
        if (!person) {
            res.status(404).json({ success: false, message: "Person not found" });
            return
        }

        await person.update({
            name: body.name,
            job: body.job,
            escort: body.escort,
            entityId: data?.id,
            image: imagePath || (person.dataValues as any).image,
        });

        const accessType = JSON.parse(body.accessType as unknown as string);
        console.log('accessType:', accessType);

        const permissions = await Permission.findAll({
            where: { permission: [accessType] },
        });

        await (person as any).setPermissions(permissions);

        const card = await Card.findOne({ where: { personId: body.personId } });
        if (card) {
            await card.update({
                expiration: new Date(body.expiration),
                cardNumber: body.cardNumber,
            });
        } else {
            await Card.create({
                expiration: new Date(body.expiration),
                cardNumber: body.cardNumber,
                personId: person.dataValues.id,
            });
        }

        res.status(200).json({ success: true, message: "Data updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(501).send(error)
    }
});

app.post('/setup/function/save', async (req: Request<{}, {}, { personFunction: string }>, res: Response) => {
    try {
        const body = req.body
        console.log(body)
        await Functions.create({ personFunction: body.personFunction })

        res.status(200).json({ success: true })
    } catch (error) {
        res.status(501).send(error)
    }
});

app.post('/setup/escort/save', async (req: Request<{}, {}, { personEscort: string }>, res: Response) => {
    try {
        const body = req.body
        await Escorts.create({ personEscort: body.personEscort })

        res.status(200).json({ success: true })
    } catch (error) {
        res.status(501).send(error)
    }
});

app.post('/setup/entity/save', async (req: Request<{}, {}, { name: string }>, res: Response) => {
    try {
        const body = req.body;
        await Entity.create({ name: body.name });

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(501).send(error);
    }
});

app.get('/setup/entity/getAll', async (_: Request, res: Response) => {
    const entities = await Entity.findAll<Model<{ name: string }>>();
    res.status(200).json(entities);
});

app.get('/card/getAll', async (_: Request, res: Response) => {
    const persons = await Card.findAll<Model<PersonType>>({
        include: {
            model: Person,
            as: 'person',
            include: [
                {
                    model: Entity,
                    as: 'entity' 
                },
                {
                    model: Permission,
                    as: 'permissions'
                }
            ]
        },
    })

    res.status(200).json(persons)
})
app.get('/setup/function/getAll', async (_: Request, res: Response) => {
    const funs = await Functions.findAll<Model<{ personFunction: string }>>()
    res.status(200).json(funs)
})

app.get('/setup/escort/getAll', async (_: Request, res: Response) => {
    const escorts = await Escorts.findAll<Model<{ personEscort: string }>>()
    res.status(200).json(escorts)
})

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});