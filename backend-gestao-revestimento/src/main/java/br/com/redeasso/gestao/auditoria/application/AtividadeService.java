package br.com.redeasso.gestao.auditoria.application;

import br.com.redeasso.gestao.auditoria.domain.Atividade;
import br.com.redeasso.gestao.auditoria.infrastructure.AtividadeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AtividadeService {

    private final AtividadeRepository atividadeRepository;

    public AtividadeService(AtividadeRepository atividadeRepository) {
        this.atividadeRepository = atividadeRepository;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public Atividade registrar(String tipo, String descricao, String pisoNome) {
        return atividadeRepository.save(new Atividade(tipo, descricao, pisoNome));
    }

    @Transactional(readOnly = true)
    public List<Atividade> listarRecentes() {
        return atividadeRepository.findTop10ByOrderByCreatedAtDescIdDesc();
    }

    @Transactional(readOnly = true)
    public long contarPorTipo(String tipo) {
        return atividadeRepository.countByTipo(tipo);
    }
}
