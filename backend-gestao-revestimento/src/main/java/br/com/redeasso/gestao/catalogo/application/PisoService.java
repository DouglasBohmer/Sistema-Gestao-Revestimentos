package br.com.redeasso.gestao.catalogo.application;

import br.com.redeasso.gestao.auditoria.application.AtividadeService;
import br.com.redeasso.gestao.catalogo.domain.DadosPiso;
import br.com.redeasso.gestao.catalogo.domain.Piso;
import br.com.redeasso.gestao.catalogo.infrastructure.PisoRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Sort;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class PisoService {

    private static final Sort ORDENACAO_CADASTRO = Sort.by(Sort.Direction.ASC, "id");

    private final PisoRepository pisoRepository;
    private final AtividadeService atividadeService;

    public PisoService(PisoRepository pisoRepository, AtividadeService atividadeService) {
        this.pisoRepository = pisoRepository;
        this.atividadeService = atividadeService;
    }

    @Transactional(readOnly = true)
    public List<Piso> listar(String search, String localDeUso, String tipoPiso) {
        return listar(search, localDeUso, tipoPiso, null);
    }

    @Transactional(readOnly = true)
    public List<Piso> listar(String search, String localDeUso, String tipoPiso, Boolean ativo) {
        String buscaNormalizada = textoOpcional(search);
        String localNormalizado = textoOpcional(localDeUso);
        String tipoNormalizado = textoOpcional(tipoPiso);

        return pisoRepository.findAll((root, query, criteriaBuilder) -> {
            List<Predicate> filtros = new ArrayList<>();

            if (buscaNormalizada != null) {
                String termo = "%" + escaparLike(buscaNormalizada.toLowerCase(Locale.ROOT)) + "%";
                filtros.add(criteriaBuilder.or(
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("nome")), termo, '\\'),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("codigoRede")), termo, '\\'),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("codigoLoja")), termo, '\\')));
            }
            if (localNormalizado != null) {
                filtros.add(criteriaBuilder.equal(root.get("localDeUso"), localNormalizado));
            }
            if (tipoNormalizado != null) {
                filtros.add(criteriaBuilder.equal(root.get("tipoPiso"), tipoNormalizado));
            }
            if (ativo != null) {
                filtros.add(criteriaBuilder.equal(root.get("ativo"), ativo));
            }

            return criteriaBuilder.and(filtros.toArray(Predicate[]::new));
        }, ORDENACAO_CADASTRO);
    }

    @Transactional(readOnly = true)
    public Piso buscarPorId(long id) {
        return pisoRepository.findById(id).orElseThrow(PisoNaoEncontradoException::new);
    }

    @Transactional(readOnly = true)
    public Piso buscarPorCodigo(String codigo) {
        List<Piso> encontrados = buscarTodosPorCodigo(codigo);
        if (encontrados.size() > 1) {
            throw new CodigoPisoAmbiguoException(encontrados);
        }
        return encontrados.getFirst();
    }

    @Transactional(readOnly = true)
    public List<Piso> buscarTodosPorCodigo(String codigo) {
        String codigoNormalizado = textoOpcional(codigo);
        if (codigoNormalizado == null) {
            throw new PisoNaoEncontradoException();
        }
        List<Piso> encontrados = pisoRepository
                .findAllByCodigoLojaOrCodigoRedeOrderByIdAsc(codigoNormalizado, codigoNormalizado);
        if (encontrados.isEmpty()) {
            throw new PisoNaoEncontradoException();
        }
        return encontrados;
    }

    @Transactional
    public Piso cadastrar(DadosPiso dados) {
        validarNomeUnico(dados.nome(), null);
        Piso piso = pisoRepository.save(Piso.cadastrar(dados));
        atividadeService.registrar(
                "cadastro",
                "Piso %s cadastrado".formatted(piso.getNome()),
                piso.getNome());
        return piso;
    }

    @Transactional
    public Piso atualizar(long id, DadosPiso dados) {
        Piso piso = buscarPorId(id);
        validarNomeUnico(dados.nome(), id);
        piso.atualizar(dados);
        Piso atualizado = pisoRepository.save(piso);
        atividadeService.registrar(
                "cadastro",
                "Piso %s atualizado".formatted(atualizado.getNome()),
                atualizado.getNome());
        return atualizado;
    }

    @Transactional
    public void excluir(long id) {
        Piso piso = buscarPorId(id);
        String nome = piso.getNome();
        try {
            pisoRepository.delete(piso);
            pisoRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            throw new PisoEmUsoException(exception);
        }
        atividadeService.registrar(
                "cadastro",
                "Piso %s excluído".formatted(nome),
                nome);
    }

    private static String textoOpcional(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    private void validarNomeUnico(String nome, Long idIgnorado) {
        String normalizado = textoOpcional(nome);
        if (normalizado == null) {
            return;
        }
        long existentes = idIgnorado == null
                ? pisoRepository.contarPorNomeNormalizado(normalizado)
                : pisoRepository.contarPorNomeNormalizadoIgnorandoId(normalizado, idIgnorado);
        if (existentes > 0) {
            throw new PisoNomeDuplicadoException();
        }
    }

    private static String escaparLike(String valor) {
        return valor.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
