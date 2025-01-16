'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Adicionar coluna entityId na tabela persons
    await queryInterface.addColumn('persons', 'entityId', {
      type: Sequelize.INTEGER,
      references: {
        model: 'entities',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      allowNull: true, // Opcional: ajuste conforme necessário
    });
  },

  async down (queryInterface, Sequelize) {
    // Remover coluna entityId de persons
    //await queryInterface.removeColumn('persons', 'entityId');

    // Deletar tabela entities
    //await queryInterface.dropTable('entities');
  }
};
