using UnityEngine;

public class TurnIndicator : MonoBehaviour
{
    [Header("Ring / Circle Renderers (4)")]
    [SerializeField] private Renderer[] circleRenderers;

    [Header("Materials")]
    [SerializeField] private Material inactiveMaterial;
    [SerializeField] private Material activeMaterial;

    private void Awake()
    {
        SetActive(false);
    }

    public void SetActive(bool isActive)
    {
        if (circleRenderers == null || circleRenderers.Length == 0) return;

        var mat = isActive ? activeMaterial : inactiveMaterial;
        if (mat == null) return;

        foreach (var r in circleRenderers)
        {
            if (r == null) continue;
            r.material = mat;
        }
    }
}
